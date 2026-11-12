import Anexo from "../../domain/entity/Anexo";
import Documento from "../../domain/entity/Documento";
import { DonoAnexo, extensaoDe } from "../../domain/enum/Anexo";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroProibido } from "../../shared/erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { Permissao } from "../../shared/seguranca/catalogoPermissoes";
import { exigirAutenticado, temPermissao, UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { podeAlterarConhecimento } from "../../shared/seguranca/regrasConhecimento";
import { podeAlterarIniciativa } from "../../shared/seguranca/regrasIniciativa";
import { podeGerirCapacitacoes } from "../../shared/seguranca/regrasCapacitacao";
import { exigirVerPasta } from "../../shared/seguranca/sigiloPastas";

const M = MENSAGENS_DE_ERRO.ANEXO;

export interface ArquivoRecebido {
    nome: string;
    conteudo: Buffer;
}

interface AcessoAoDono {
    podeAlterar: boolean;
    semPermissao: string;
}

/**
 * Anexos (sessão 12c, decisões de 09/11/2026). Cada anexo segue as regras do dono:
 * - documento de pasta: baixa quem pode ler a pasta (sigilo da sessão 9); envia e exclui a gestão;
 * - item da Base: todos baixam; envia e exclui quem pode alterar o item (autor ou gestão);
 * - iniciativa: todos baixam; envia e exclui quem pode alterá-la (responsável, quem criou ou gestão);
 * - capacitação (sessão 13): todos baixam o material; envia e exclui a gestão.
 * Quem não pode ler o dono recebe 404, como se o anexo não existisse.
 */
export default class GerirAnexos {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    private get anexos() {
        return this.factory.criarAnexoRepository();
    }

    private get armazenamento() {
        return this.factory.criarArmazenamentoAnexos();
    }

    /** Confere se o dono existe e se a pessoa pode lê-lo (senão 404); diz se pode alterar. */
    private async acesso(usuario: UsuarioAutenticado, tipo: DonoAnexo, codigo: string): Promise<AcessoAoDono> {
        if (tipo === DonoAnexo.DOCUMENTO) {
            const documento = await this.factory.criarDocumentoRepository().buscarPorCodigo(codigo);
            if (!documento) throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
            await exigirVerPasta(usuario, documento.pasta, this.factory);
            return { podeAlterar: temPermissao(usuario, Permissao.DOCUMENTOS_GERIR), semPermissao: M.SEM_PERMISSAO_DOCUMENTO };
        }
        if (tipo === DonoAnexo.CONHECIMENTO) {
            const item = await this.factory.criarConhecimentoRepository().buscarPorCodigo(codigo);
            if (!item) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CONHECIMENTO.NAO_ENCONTRADO);
            return { podeAlterar: podeAlterarConhecimento(usuario, item), semPermissao: MENSAGENS_DE_ERRO.CONHECIMENTO.SEM_PERMISSAO };
        }
        if (tipo === DonoAnexo.CAPACITACAO) {
            const capacitacao = await this.factory.criarCapacitacaoRepository().buscarPorCodigo(codigo);
            if (!capacitacao) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CAPACITACAO.NAO_ENCONTRADA);
            return { podeAlterar: podeGerirCapacitacoes(usuario), semPermissao: M.SEM_PERMISSAO_CAPACITACAO };
        }
        const item = await this.factory.criarIniciativaRepository().buscarPorCodigo(codigo);
        if (!item) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.INICIATIVA.NAO_ENCONTRADA);
        return { podeAlterar: podeAlterarIniciativa(usuario, item), semPermissao: MENSAGENS_DE_ERRO.INICIATIVA.SEM_PERMISSAO };
    }

    /** Grava o arquivo e depois o registro; se o registro falhar, apaga o arquivo. */
    private async gravar(anexo: Anexo, conteudo: Buffer): Promise<Anexo> {
        await this.armazenamento.salvar(anexo.arquivo, conteudo);
        try {
            return await this.anexos.criar(anexo);
        } catch (erro) {
            await this.armazenamento.excluir(anexo.arquivo);
            throw erro;
        }
    }

    private novo(usuario: UsuarioAutenticado, tipo: DonoAnexo, codigoDono: string, arquivo: ArquivoRecebido): Anexo {
        return new Anexo({
            donoTipo: tipo,
            donoCodigo: codigoDono,
            nome: arquivo.nome,
            tamanhoBytes: arquivo.conteudo?.length ?? 0,
            enviadoPor: { codigo: usuario.codigo, nome: String((usuario as { nome?: string }).nome ?? "") },
        });
    }

    /** Anexa um arquivo a um item da Base, a uma iniciativa ou a uma capacitação. */
    async enviar(
        usuario: UsuarioAutenticado | null | undefined,
        tipo: DonoAnexo,
        codigoDono: string,
        arquivo: ArquivoRecebido,
    ): Promise<Anexo> {
        const autenticado = exigirAutenticado(usuario);
        const acesso = await this.acesso(autenticado, tipo, codigoDono);
        if (!acesso.podeAlterar) throw new ErroProibido(acesso.semPermissao);
        return this.gravar(this.novo(autenticado, tipo, codigoDono, arquivo), arquivo.conteudo);
    }

    /** Documento de pasta do tipo arquivo: cria o documento (sem link) e o anexo dele. */
    async enviarDocumento(
        usuario: UsuarioAutenticado | null | undefined,
        codigoPasta: string,
        arquivo: ArquivoRecebido,
        nome?: string,
    ): Promise<Documento & { anexo: Anexo }> {
        const autenticado = exigirAutenticado(usuario);
        if (!temPermissao(autenticado, Permissao.DOCUMENTOS_GERIR)) throw new ErroProibido(M.SEM_PERMISSAO_DOCUMENTO);
        const pasta = await this.factory.criarPastaRepository().buscarPorCodigo(codigoPasta);
        if (!pasta) throw new ErroNaoEncontrado("Pasta não encontrada.");
        const autor = await this.factory.criarUsuarioRepository().buscarPorCodigo(autenticado.codigo);
        if (!autor || !autor.ativo) throw new ErroNaoEncontrado("Usuário ativo não encontrado.");

        // Valida o arquivo (tipo, tamanho, nome) antes de criar o documento.
        const nomeArquivo = this.novo(autenticado, DonoAnexo.DOCUMENTO, codigoPasta, arquivo).nome;
        const documentos = this.factory.criarDocumentoRepository();
        const nomeDocumento = (nome ?? "").trim() || nomeArquivo.replace(/\.[^.]+$/, "") || nomeArquivo;
        const documento = await documentos.criar(
            new Documento(pasta, nomeDocumento, arquivo.conteudo.length, new Date(), autor, null, extensaoDe(nomeArquivo) || null),
        );
        try {
            const anexo = await this.gravar(this.novo(autenticado, DonoAnexo.DOCUMENTO, documento.codigo, arquivo), arquivo.conteudo);
            return Object.assign(documento, { anexo });
        } catch (erro) {
            await documentos.excluir(documento.codigo);
            throw erro;
        }
    }

    /** Anexo + conteúdo, para baixar. */
    async baixar(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<{ anexo: Anexo; conteudo: Buffer }> {
        const autenticado = exigirAutenticado(usuario);
        const anexo = await this.anexos.buscarPorCodigo(codigo);
        if (!anexo) throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        await this.acesso(autenticado, anexo.donoTipo, anexo.donoCodigo).catch(() => {
            throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        });
        const conteudo = await this.armazenamento.ler(anexo.arquivo);
        if (!conteudo) throw new ErroNaoEncontrado(M.ARQUIVO_SUMIU);
        return { anexo, conteudo };
    }

    /** Exclui um anexo da Base, de uma iniciativa ou de uma capacitação (o de documento sai junto com o documento). */
    async excluir(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<{ codigo: string }> {
        const autenticado = exigirAutenticado(usuario);
        const anexo = await this.anexos.buscarPorCodigo(codigo);
        if (!anexo) throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        const acesso = await this.acesso(autenticado, anexo.donoTipo, anexo.donoCodigo).catch(() => {
            throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        });
        if (!acesso.podeAlterar) throw new ErroProibido(acesso.semPermissao);
        if (anexo.donoTipo === DonoAnexo.DOCUMENTO) {
            await this.excluirDosDonos(DonoAnexo.DOCUMENTO, [anexo.donoCodigo]);
            await this.factory.criarDocumentoRepository().excluir(anexo.donoCodigo);
        } else {
            await this.apagar(anexo);
        }
        return { codigo };
    }

    private async apagar(anexo: Anexo): Promise<void> {
        await this.anexos.excluir(anexo.codigo);
        await this.armazenamento.excluir(anexo.arquivo);
    }

    /** Chamado quando o dono é excluído: apaga registros e arquivos. */
    async excluirDosDonos(tipo: DonoAnexo, codigos: string[]): Promise<void> {
        for (const anexo of await this.anexos.listarPorDonos(tipo, codigos)) await this.apagar(anexo);
    }

    /** Anexos agrupados por dono, para acrescentar às respostas. */
    async porDono(tipo: DonoAnexo, codigos: string[]): Promise<Map<string, Anexo[]>> {
        const mapa = new Map<string, Anexo[]>();
        for (const anexo of await this.anexos.listarPorDonos(tipo, codigos)) {
            mapa.set(anexo.donoCodigo, [...(mapa.get(anexo.donoCodigo) ?? []), anexo]);
        }
        return mapa;
    }
}
