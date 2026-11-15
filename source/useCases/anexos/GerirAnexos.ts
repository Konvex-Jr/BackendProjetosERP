import Anexo from "../../domain/entity/Anexo";
import { DonoAnexo } from "../../domain/enum/Anexo";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroProibido } from "../../shared/erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { exigirAutenticado, UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { podeGerirCapacitacoes } from "../../shared/seguranca/regrasCapacitacao";
import { exigirVerItem, podeAlterarItem } from "../../shared/seguranca/regrasBiblioteca";

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
 * - item da Biblioteca (sessão 17): baixa quem vê o item (sigilo); envia e exclui quem pode alterá-lo;
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
        if (tipo === DonoAnexo.BIBLIOTECA) {
            const item = await this.factory.criarBibliotecaRepository().buscarPorCodigo(codigo);
            // Inexistente ou invisível: 404 (exigirVerItem não distingue os dois casos).
            const visivel = await exigirVerItem(usuario, item, this.factory);
            return { podeAlterar: podeAlterarItem(usuario, visivel), semPermissao: MENSAGENS_DE_ERRO.BIBLIOTECA.SEM_PERMISSAO };
        }
        if (tipo === DonoAnexo.CAPACITACAO) {
            const capacitacao = await this.factory.criarCapacitacaoRepository().buscarPorCodigo(codigo);
            if (!capacitacao) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CAPACITACAO.NAO_ENCONTRADA);
            return { podeAlterar: podeGerirCapacitacoes(usuario), semPermissao: M.SEM_PERMISSAO_CAPACITACAO };
        }
        // Dono de módulo que saiu (sessão 17) ou desconhecido: como se o anexo não existisse.
        throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
    }

    /**
     * Grava o arquivo e depois o registro; se o registro falhar, apaga o arquivo.
     * Nessa ordem, uma falha no meio deixa no máximo um arquivo sem registro (que a conferência
     * de anexos aponta), nunca um registro apontando para um arquivo que não existe.
     */
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

    /** Anexa um arquivo a um item da Biblioteca ou a uma capacitação. */
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

    /** Anexo + conteúdo, para baixar. */
    async baixar(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<{ anexo: Anexo; conteudo: Buffer }> {
        const autenticado = exigirAutenticado(usuario);
        const anexo = await this.anexos.buscarPorCodigo(codigo);
        if (!anexo) throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        // Sem acesso ao dono (ou dono apagado): responde como se o anexo não existisse.
        await this.acesso(autenticado, anexo.donoTipo, anexo.donoCodigo).catch(() => {
            throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        });
        const conteudo = await this.armazenamento.ler(anexo.arquivo);
        if (!conteudo) throw new ErroNaoEncontrado(M.ARQUIVO_SUMIU);
        return { anexo, conteudo };
    }

    /** Exclui um anexo de um item da Biblioteca ou de uma capacitação. */
    async excluir(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<{ codigo: string }> {
        const autenticado = exigirAutenticado(usuario);
        const anexo = await this.anexos.buscarPorCodigo(codigo);
        if (!anexo) throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        const acesso = await this.acesso(autenticado, anexo.donoTipo, anexo.donoCodigo).catch(() => {
            throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        });
        if (!acesso.podeAlterar) throw new ErroProibido(acesso.semPermissao);
        await this.apagar(anexo);
        return { codigo };
    }

    /** Registro primeiro, arquivo depois: se o disco falhar, sobra um arquivo órfão, não um link quebrado. */
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
