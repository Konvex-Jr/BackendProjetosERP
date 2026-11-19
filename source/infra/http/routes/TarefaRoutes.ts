import { hoje } from "../../../shared/datas";
import { lerDataObrigatoria } from "../../../shared/entradas";
import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import PrioridadeTarefa from "../../../domain/enum/PrioridadeTarefa";
import DificuldadeTarefa from "../../../domain/enum/DificuldadeTarefa";
import StatusTarefa from "../../../domain/enum/StatusTarefa";
import Tarefa from "../../../domain/entity/Tarefa";
import ComentarioTarefa from "../../../domain/entity/ComentarioTarefa";
import { DonoAnexo } from "../../../domain/enum/Anexo";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarTarefas from "../../../useCases/tarefas/ListarTarefas";
import CriarTarefa from "../../../useCases/tarefas/CriarTarefa";
import EditarTarefa from "../../../useCases/tarefas/EditarTarefa";
import AlterarStatusTarefa from "../../../useCases/tarefas/AlterarStatusTarefa";
import CorrigirConclusao from "../../../useCases/tarefas/CorrigirConclusao";
import MoverTarefa from "../../../useCases/tarefas/MoverTarefa";
import ExcluirTarefa from "../../../useCases/tarefas/ExcluirTarefa";
import { exigirAutenticado, UsuarioAutenticado } from "../../../shared/seguranca/permissoes";
import { ErroProibido } from "../../../shared/erros/ErroProibido";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import ListarProjetos from "../../../useCases/projetos/ListarProjetos";
import { acessoAoProjeto, exigirAcessoCompleto, podeVerTodosProjetos } from "../../../shared/seguranca/visibilidadeProjetos";
import { papelNoProjeto, RegrasTarefa } from "../../../shared/seguranca/regrasTarefa";
import { carregarTarefa } from "../../../useCases/tarefas/carregarTarefa";
import ConsultarOcupacao from "../../../useCases/tarefas/ConsultarOcupacao";

const TAREFA_NAO_ENCONTRADA = "Tarefa não encontrada.";

/** Ausente = undefined (mantém); null ou "" = null (limpa). Valor desconhecido o `Tarefa` recusa com 400 DIFICULDADE_INVALIDA. */
function lerDificuldade(valor: unknown): DificuldadeTarefa | null | undefined {
    if (valor === undefined) return undefined;
    if (valor === null || valor === "") return null;
    return valor as DificuldadeTarefa;
}

/** Tarefas e comentários. Quem pode o quê: `regrasTarefa.ts` (sessões 8b, 20 e 23b). */
export default class TarefaRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    private async carregar(usuario: UsuarioAutenticado, codigo: string): Promise<{ tarefa: Tarefa; regras: RegrasTarefa }> {
        const { tarefa, projeto, regras } = await carregarTarefa(this.factory, usuario, codigo);
        if (projeto?.sigiloso && !regras.ver) {
            // Quem não vê nada do sigiloso recebe o mesmo 404 da tarefa inexistente: "Projeto não encontrado."
            // revelaria que a tarefa existe. O gerente fora (resumo) recebe 403, como nas rotas do projeto.
            if (acessoAoProjeto(usuario, projeto) === "nada") throw new ErroNaoEncontrado(TAREFA_NAO_ENCONTRADA);
            exigirAcessoCompleto(usuario, projeto);
        }
        return { tarefa, regras };
    }

    /** Editar e excluir: quem organiza ou o participante que criou a tarefa (sessão 24b). */
    private async exigirEditar(usuario: UsuarioAutenticado, codigo: string) {
        const r = await this.carregar(usuario, codigo);
        if (!r.regras.editar) throw new ErroProibido(MENSAGENS_DE_ERRO.TAREFA.SEM_PERMISSAO_EDITAR);
        return r;
    }

    /** Acrescenta `quantidadeAnexos` (uma consulta para todas) às tarefas da resposta. */
    private async comAnexos(tarefas: Tarefa[]) {
        const contagem = await this.factory.criarAnexoRepository().contarPorDonos(
            DonoAnexo.TAREFA,
            tarefas.map((t) => t.codigo),
        );
        return tarefas.map((t) => ({ ...t.toJSON(), quantidadeAnexos: contagem.get(t.codigo) ?? 0 }));
    }

    private async comAnexosDe(tarefa: Tarefa) {
        return (await this.comAnexos([tarefa]))[0];
    }

    /** Resposta das gravações: a tarefa como antes, mais `avisosOcupacao` (responsáveis acima de 100% na semana; sessão 24a). */
    private async comAvisos(antes: Tarefa | null, depois: Tarefa) {
        // A tarefa já foi gravada: falha no cálculo do aviso não pode virar 500.
        const avisosOcupacao = await new ConsultarOcupacao(this.factory).avisos(antes, depois).catch((erro) => {
            console.error("Aviso de ocupação não calculado:", erro?.message ?? erro);
            return [];
        });
        return { ...(await this.comAnexosDe(depois)), avisosOcupacao };
    }

    private async usuarioAtual(usuario: UsuarioAutenticado) {
        return this.factory.criarUsuarioRepository().buscarPorCodigo(usuario.codigo);
    }

    init(): void {
        this.http.route("get", "/tarefas", true, async (_params: any, body: any, query: any) => {
            const usuario = exigirAutenticado(body?.user);
            const minhas = query?.minhas === "true" || query?.minhas === "1";
            const tarefas = await new ListarTarefas(this.factory).execute({
                codigoProjeto: query?.codigoProjeto,
                codigoResponsavel: minhas ? usuario.codigo : query?.codigoResponsavel,
                status: query?.status,
            });
            // Tarefa de projeto sigiloso só vai para quem tem acesso completo ao projeto (nem o responsável que saiu,
            // nem a gestão fora). Usa o projeto atual (equipe de hoje), não o que veio junto da tarefa.
            const sigilosos = new Map((await this.factory.criarProjetoRepository().listarSigilosos()).map((p) => [p.codigo, p]));
            const semSigilosoAlheio = tarefas.filter((t) => {
                const sigiloso = sigilosos.get(t.projeto.codigo);
                return !sigiloso || acessoAoProjeto(usuario, sigiloso) === "completo";
            });
            if (podeVerTodosProjetos(usuario)) return this.comAnexos(semSigilosoAlheio);
            // Membro: tarefas dos projetos de que participa ou participou (no geral da área, pelos períodos ou por
            // liderar a área) e as em que é responsável.
            const visiveis = new Set(
                (await new ListarProjetos(this.factory).execute({ codigoUsuario: usuario.codigo })).map((p) => p.codigo),
            );
            return this.comAnexos(
                semSigilosoAlheio.filter(
                    (t) =>
                        t.responsaveis.some((r) => r.codigo === usuario.codigo) ||
                        podeVerTodosProjetos(usuario) ||
                        visiveis.has(t.projeto.codigo),
                ),
            );
        });

        this.http.route("post", "/tarefas", true, async (_params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            let codigosResponsaveis: string[] = body.codigosResponsaveis ?? [];
            // Toda tarefa tem projeto (sessão 23b): sem ele, 400 para todos, antes da permissão. `categoria` é ignorada.
            if (!body.codigoProjeto) throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.PROJETO_OBRIGATORIO, "PROJETO_OBRIGATORIO");
            const projeto = await this.factory.criarProjetoRepository().buscarPorCodigo(body.codigoProjeto);
            if (projeto?.sigiloso) exigirAcessoCompleto(usuario, projeto);
            const papel = papelNoProjeto(usuario, projeto);
            if (papel === "nenhum") throw new ErroProibido("Você só pode criar tarefas em projetos de cuja equipe faz parte.");
            // Participante cria e fica como responsável; o líder organiza depois.
            if (papel === "participante") codigosResponsaveis = [usuario.codigo];
            return this.comAvisos(
                null,
                await new CriarTarefa(this.factory).execute({
                    codigoProjeto: body.codigoProjeto,
                    titulo: body.titulo ?? "",
                    dataInicio: lerDataObrigatoria(body.dataInicio, "dataInicio"),
                    dataFim: lerDataObrigatoria(body.dataFim, "dataFim"),
                    prioridade: body.prioridade as PrioridadeTarefa,
                    codigoColuna: body.codigoColuna ?? null,
                    dificuldade: lerDificuldade(body.dificuldade) ?? null,
                    descricao: body.descricao ?? null,
                    codigosResponsaveis,
                    criadaPor: await this.usuarioAtual(usuario),
                }),
            );
        });

        this.http.route("put", "/tarefas/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { tarefa: antes, regras } = await this.exigirEditar(usuario, params.codigo);
            return this.comAvisos(
                antes,
                await new EditarTarefa(this.factory).execute({
                    codigo: params.codigo,
                    titulo: body.titulo,
                    dataInicio: lerDataObrigatoria(body.dataInicio, "dataInicio"),
                    dataFim: lerDataObrigatoria(body.dataFim, "dataFim"),
                    status: body.status as StatusTarefa,
                    prioridade: body.prioridade as PrioridadeTarefa,
                    codigoColuna: body.codigoColuna ?? null,
                    dificuldade: lerDificuldade(body.dificuldade),
                    descricao: body.descricao ?? null,
                    codigosResponsaveis: body.codigosResponsaveis ?? [],
                    manterResponsaveis: !regras.organizar,
                    manterSituacao: !regras.mudarStatus,
                    dataConclusao: body.dataConclusao ? lerDataObrigatoria(body.dataConclusao, "dataConclusao") : undefined,
                    codigoDependencia: body.codigoDependencia ?? null,
                    checklist: Array.isArray(body.checklist)
                        ? body.checklist.map((item: any) => ({
                              codigo: item.codigo ?? item.id,
                              texto: item.texto,
                              feito: Boolean(item.feito),
                          }))
                        : undefined,
                    quem: await this.usuarioAtual(usuario),
                }),
            );
        });

        this.http.route("patch", "/tarefas/:codigo/status", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { tarefa: antes, regras } = await this.carregar(usuario, params.codigo);
            if (!regras.mudarStatus) {
                throw new ErroProibido("Você só pode concluir ou reabrir tarefas em que é responsável.");
            }
            return this.comAvisos(
                antes,
                await new AlterarStatusTarefa(this.factory).execute(
                    params.codigo,
                    body.status as StatusTarefa,
                    hoje(),
                    await this.usuarioAtual(usuario),
                ),
            );
        });

        this.http.route("patch", "/tarefas/:codigo/coluna", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { tarefa: antes, regras } = await this.carregar(usuario, params.codigo);
            if (!regras.mudarStatus) {
                throw new ErroProibido(MENSAGENS_DE_ERRO.TAREFA.SEM_PERMISSAO_MOVER);
            }
            return this.comAvisos(
                antes,
                await new MoverTarefa(this.factory).execute(params.codigo, body.codigoColuna, hoje(), await this.usuarioAtual(usuario)),
            );
        });

        // Corrige a data de conclusão: quem pode mudar a situação (responsável, líder, gestão) ou editar.
        this.http.route("patch", "/tarefas/:codigo/conclusao", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { tarefa: antes, regras } = await this.carregar(usuario, params.codigo);
            if (!regras.mudarStatus && !regras.editar) throw new ErroProibido(MENSAGENS_DE_ERRO.TAREFA.SEM_PERMISSAO_EDITAR);
            const data = lerDataObrigatoria(body.dataConclusao, "dataConclusao");
            return this.comAvisos(antes, await new CorrigirConclusao(this.factory).execute(params.codigo, data, hoje()));
        });

        this.http.route("delete", "/tarefas/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            await this.exigirEditar(usuario, params.codigo);
            return new ExcluirTarefa(this.factory).execute(params.codigo);
        });

        // Comentários (sessão 8b)
        this.http.route("get", "/tarefas/:codigo/comentarios", true, async (params: any, body: any) => {
            const { regras } = await this.carregar(exigirAutenticado(body.user), params.codigo);
            if (!regras.ver) throw new ErroProibido("Você só pode ver os projetos de que participa.");
            return this.factory.criarComentarioTarefaRepository().listarPorTarefa(params.codigo);
        });

        this.http.route("post", "/tarefas/:codigo/comentarios", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { regras } = await this.carregar(usuario, params.codigo);
            if (!regras.comentar) throw new ErroProibido("Só a equipe atual do projeto comenta nas tarefas.");
            const autor = await this.usuarioAtual(usuario);
            if (!autor) throw new ErroNaoEncontrado("Pessoa não encontrada.");
            return this.factory.criarComentarioTarefaRepository().criar(new ComentarioTarefa(params.codigo, autor, body.texto));
        });

        this.http.route("delete", "/tarefas/:codigo/comentarios/:codigoComentario", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const repo = this.factory.criarComentarioTarefaRepository();
            const comentario = await repo.buscarPorCodigo(params.codigoComentario);
            if (!comentario || comentario.codigoTarefa !== params.codigo) throw new ErroNaoEncontrado("Comentário não encontrado.");
            const { regras } = await this.carregar(usuario, params.codigo);
            if (comentario.autor.codigo !== usuario.codigo && !regras.organizar) {
                throw new ErroProibido("Você só pode apagar os próprios comentários.");
            }
            await repo.excluir(comentario.codigo);
            return { ok: true };
        });
    }
}
