import Anexo from "../../domain/entity/Anexo";
import { DonoAnexo } from "../../domain/enum/Anexo";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroProibido } from "../../shared/erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { exigirAutenticado, exigirPermissao, Permissao, UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { podeGerirCapacitacoes } from "../../shared/seguranca/regrasCapacitacao";
import { exigirVerItem, podeAlterarItem } from "../../shared/seguranca/regrasBiblioteca";
import { RegrasTarefa } from "../../shared/seguranca/regrasTarefa";
import { carregarTarefa } from "../tarefas/carregarTarefa";

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
 * - capacitação (sessão 13): todos baixam o material; envia e exclui a gestão;
 * - tarefa (sessão 19, regras dos comentários em `regrasTarefa`): vê e baixa quem vê a tarefa; envia quem
 *   comenta (equipe atual do projeto); exclui quem enviou ou quem organiza.
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

    /** Tarefa que a pessoa vê, com as regras dela; inexistente ou invisível: 404 (o mesmo para os dois casos). */
    private async tarefaVisivel(usuario: UsuarioAutenticado, codigo: string): Promise<{ regras: RegrasTarefa }> {
        const { regras } = await carregarTarefa(this.factory, usuario, codigo);
        if (!regras.ver) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        return { regras };
    }

    /** Na tarefa, exclui quem enviou o anexo (mesmo que tenha saído da equipe, se ainda vê a tarefa) ou quem organiza. */
    private podeExcluirDaTarefa(usuario: UsuarioAutenticado, regras: RegrasTarefa, anexo: Anexo): boolean {
        return anexo.enviadoPor?.codigo === usuario.codigo || regras.organizar;
    }

    /**
     * Confere se o dono existe e se a pessoa pode lê-lo (senão 404); diz se pode alterar.
     * Com o `anexo` (exclusão), a tarefa decide por ele; Biblioteca e capacitação ignoram o anexo.
     */
    private async acesso(usuario: UsuarioAutenticado, tipo: DonoAnexo, codigo: string, anexo?: Anexo): Promise<AcessoAoDono> {
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
        if (tipo === DonoAnexo.TAREFA) {
            const { regras } = await this.tarefaVisivel(usuario, codigo);
            if (anexo) return { podeAlterar: this.podeExcluirDaTarefa(usuario, regras, anexo), semPermissao: M.SO_OS_PROPRIOS };
            return {
                podeAlterar: regras.comentar,
                semPermissao: M.SEM_PERMISSAO_TAREFA_PROJETO,
            };
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

    /** Trainee (sessão 20) não usa a Biblioteca: 403 (e não 404) nos anexos dos itens dela. */
    private semTraineeNaBiblioteca(usuario: UsuarioAutenticado, tipo: DonoAnexo): void {
        if (tipo === DonoAnexo.BIBLIOTECA) exigirPermissao(usuario, Permissao.BIBLIOTECA_USAR, MENSAGENS_DE_ERRO.USUARIO.SEM_BIBLIOTECA);
    }

    /** Anexa um arquivo a um item da Biblioteca, a uma capacitação ou a uma tarefa. */
    async enviar(
        usuario: UsuarioAutenticado | null | undefined,
        tipo: DonoAnexo,
        codigoDono: string,
        arquivo: ArquivoRecebido,
    ): Promise<Anexo> {
        const autenticado = exigirAutenticado(usuario);
        this.semTraineeNaBiblioteca(autenticado, tipo);
        const acesso = await this.acesso(autenticado, tipo, codigoDono);
        if (!acesso.podeAlterar) throw new ErroProibido(acesso.semPermissao);
        return this.gravar(this.novo(autenticado, tipo, codigoDono, arquivo), arquivo.conteudo);
    }

    /** Anexo + conteúdo, para baixar. */
    async baixar(
        usuario: UsuarioAutenticado | null | undefined,
        codigo: string,
    ): Promise<{ anexo: Anexo; fluxo: NodeJS.ReadableStream; tamanho: number }> {
        const autenticado = exigirAutenticado(usuario);
        const anexo = await this.anexos.buscarPorCodigo(codigo);
        if (!anexo) throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        this.semTraineeNaBiblioteca(autenticado, anexo.donoTipo);
        // Sem acesso ao dono (ou dono apagado): responde como se o anexo não existisse.
        await this.acesso(autenticado, anexo.donoTipo, anexo.donoCodigo).catch(() => {
            throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        });
        // Abre antes de responder: arquivo que sumiu vira 404 com JSON, sem ter enviado byte algum.
        const aberto = await this.armazenamento.abrir(anexo.arquivo);
        if (!aberto) throw new ErroNaoEncontrado(M.ARQUIVO_SUMIU);
        return { anexo, ...aberto };
    }

    /** Exclui um anexo de um item da Biblioteca, de uma capacitação ou de uma tarefa. */
    async excluir(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<{ codigo: string }> {
        const autenticado = exigirAutenticado(usuario);
        const anexo = await this.anexos.buscarPorCodigo(codigo);
        if (!anexo) throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        this.semTraineeNaBiblioteca(autenticado, anexo.donoTipo);
        const acesso = await this.acesso(autenticado, anexo.donoTipo, anexo.donoCodigo, anexo).catch(() => {
            throw new ErroNaoEncontrado(M.NAO_ENCONTRADO);
        });
        if (!acesso.podeAlterar) throw new ErroProibido(acesso.semPermissao);
        await this.apagar(anexo);
        return { codigo };
    }

    /** Anexos de uma tarefa (do mais antigo ao mais novo), com `podeExcluir` para quem pede. 404 se não vê a tarefa. */
    async listar(
        usuario: UsuarioAutenticado | null | undefined,
        tipo: DonoAnexo.TAREFA,
        codigoDono: string,
    ): Promise<Array<ReturnType<Anexo["toJSON"]> & { podeExcluir: boolean }>> {
        const autenticado = exigirAutenticado(usuario);
        const { regras } = await this.tarefaVisivel(autenticado, codigoDono);
        const anexos = await this.anexos.listarPorDonos(tipo, [codigoDono]);
        return anexos.map((anexo) => ({ ...anexo.toJSON(), podeExcluir: this.podeExcluirDaTarefa(autenticado, regras, anexo) }));
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
