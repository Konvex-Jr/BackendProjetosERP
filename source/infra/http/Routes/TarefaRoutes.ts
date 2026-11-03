import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import PrioridadeTarefa from "../../../domain/Enum/PrioridadeTarefa";
import StatusTarefa from "../../../domain/Enum/StatusTarefa";
import Tarefa from "../../../domain/Entity/Tarefa";
import ComentarioTarefa from "../../../domain/Entity/ComentarioTarefa";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarTarefas from "../../../useCases/ListarTarefas/ListarTarefas";
import CriarTarefa from "../../../useCases/CriarTarefa/CriarTarefa";
import EditarTarefa from "../../../useCases/EditarTarefa/EditarTarefa";
import AlterarStatusTarefa from "../../../useCases/AlterarStatusTarefa/AlterarStatusTarefa";
import ExcluirTarefa from "../../../useCases/ExcluirTarefa/ExcluirTarefa";
import { exigirAutenticado, UsuarioAutenticado } from "../../../shared/seguranca/permissoes";
import { ErroProibido } from "../../../shared/erros/ErroProibido";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import ListarProjetos from "../../../useCases/ListarProjetos/ListarProjetos";
import { exigirVerProjeto, podeVerTodosProjetos } from "../../../shared/seguranca/visibilidadeProjetos";
import { organizaTarefas, papelNoProjeto, PapelProjeto, podeMudarStatus } from "../../../shared/seguranca/papelProjeto";

const SO_LIDER = "Só o líder do projeto e a gestão podem fazer isso.";

/** Tarefas e comentários. Regras por papel no projeto: ver `papelProjeto.ts` (sessão 8b). */
export default class TarefaRoutes implements ModelRoutes {
    constructor(private readonly http: Http, private readonly factory: RepositoryFactoryInterface) {}

    private async carregar(usuario: UsuarioAutenticado, codigo: string): Promise<{ tarefa: Tarefa; papel: PapelProjeto }> {
        const tarefa = await this.factory.criarTarefaRepository().buscarPorCodigo(codigo);
        if (!tarefa) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        const projeto = await this.factory.criarProjetoRepository().buscarPorCodigo(tarefa.projeto.codigo);
        return { tarefa, papel: papelNoProjeto(usuario, projeto) };
    }

    /** Ver a tarefa (e os comentários): quem vê o projeto ou é responsável por ela. */
    private async carregarVisivel(usuario: UsuarioAutenticado, codigo: string) {
        const r = await this.carregar(usuario, codigo);
        if (!r.tarefa.responsaveis.some((x) => x.codigo === usuario.codigo)) exigirVerProjeto(usuario, r.tarefa.projeto);
        return r;
    }

    private async usuarioAtual(usuario: UsuarioAutenticado) {
        return this.factory.criarUsuarioRepository().buscarPorCodigo(usuario.codigo);
    }

    init(): void {
        this.http.route("get", "/tarefas", true, async (_params: any, body: any, query: any) => {
            const usuario = exigirAutenticado(body?.user);
            const tarefas = await new ListarTarefas(this.factory).execute({
                codigoProjeto: query?.codigoProjeto,
                codigoResponsavel: query?.codigoResponsavel,
            });
            if (podeVerTodosProjetos(usuario)) return tarefas;
            // Membro: só tarefas dos projetos de que participa ou participou, ou em que é responsável.
            const visiveis = new Set(
                (await new ListarProjetos(this.factory).execute({ codigoUsuario: usuario.codigo })).map((p) => p.codigo),
            );
            return tarefas.filter((t) =>
                visiveis.has(t.projeto.codigo) || t.responsaveis.some((r) => r.codigo === usuario.codigo));
        });

        this.http.route("post", "/tarefas", true, async (_params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const projeto = await this.factory.criarProjetoRepository().buscarPorCodigo(body.codigoProjeto);
            const papel = papelNoProjeto(usuario, projeto);
            let codigosResponsaveis: string[] = body.codigosResponsaveis ?? [];
            if (papel === "nenhum") throw new ErroProibido("Você só pode criar tarefas em projetos de cuja equipe faz parte.");
            // Participante cria e fica como responsável; o líder organiza depois.
            if (papel === "participante") codigosResponsaveis = [usuario.codigo];
            return new CriarTarefa(this.factory).execute({
                codigoProjeto: body.codigoProjeto,
                titulo: body.titulo,
                dataInicio: new Date(body.dataInicio),
                dataFim: new Date(body.dataFim),
                prioridade: body.prioridade as PrioridadeTarefa,
                descricao: body.descricao ?? null,
                codigosResponsaveis,
            });
        });

        this.http.route("put", "/tarefas/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { papel } = await this.carregar(usuario, params.codigo);
            if (!organizaTarefas(papel)) throw new ErroProibido(SO_LIDER);
            return new EditarTarefa(this.factory).execute({
                codigo: params.codigo,
                titulo: body.titulo,
                dataInicio: new Date(body.dataInicio),
                dataFim: new Date(body.dataFim),
                status: body.status as StatusTarefa,
                prioridade: body.prioridade as PrioridadeTarefa,
                descricao: body.descricao ?? null,
                codigosResponsaveis: body.codigosResponsaveis ?? [],
                codigoDependencia: body.codigoDependencia ?? null,
                checklist: Array.isArray(body.checklist)
                    ? body.checklist.map((item: any) => ({
                        codigo: item.codigo ?? item.id,
                        texto: item.texto,
                        feito: Boolean(item.feito),
                    }))
                    : undefined,
                quem: await this.usuarioAtual(usuario),
            });
        });

        this.http.route("patch", "/tarefas/:codigo/status", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { tarefa, papel } = await this.carregar(usuario, params.codigo);
            if (!podeMudarStatus(usuario, papel, tarefa)) {
                throw new ErroProibido("Você só pode concluir ou reabrir tarefas em que é responsável.");
            }
            return new AlterarStatusTarefa(this.factory).execute(
                params.codigo, body.status as StatusTarefa, new Date(), await this.usuarioAtual(usuario));
        });

        this.http.route("delete", "/tarefas/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { papel } = await this.carregar(usuario, params.codigo);
            if (!organizaTarefas(papel)) throw new ErroProibido(SO_LIDER);
            return new ExcluirTarefa(this.factory).execute(params.codigo);
        });

        // Comentários (sessão 8b)
        this.http.route("get", "/tarefas/:codigo/comentarios", true, async (params: any, body: any) => {
            await this.carregarVisivel(exigirAutenticado(body.user), params.codigo);
            return this.factory.criarComentarioTarefaRepository().listarPorTarefa(params.codigo);
        });

        this.http.route("post", "/tarefas/:codigo/comentarios", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { papel } = await this.carregar(usuario, params.codigo);
            if (papel === "nenhum") throw new ErroProibido("Só a equipe atual do projeto comenta nas tarefas.");
            const autor = await this.usuarioAtual(usuario);
            if (!autor) throw new ErroNaoEncontrado("Pessoa não encontrada.");
            return this.factory.criarComentarioTarefaRepository().criar(new ComentarioTarefa(params.codigo, autor, body.texto));
        });

        this.http.route("delete", "/tarefas/:codigo/comentarios/:codigoComentario", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const repo = this.factory.criarComentarioTarefaRepository();
            const comentario = await repo.buscarPorCodigo(params.codigoComentario);
            if (!comentario || comentario.codigoTarefa !== params.codigo) throw new ErroNaoEncontrado("Comentário não encontrado.");
            const { papel } = await this.carregar(usuario, params.codigo);
            if (comentario.autor.codigo !== usuario.codigo && !organizaTarefas(papel)) {
                throw new ErroProibido("Você só pode apagar os próprios comentários.");
            }
            await repo.excluir(comentario.codigo);
            return { ok: true };
        });
    }
}
