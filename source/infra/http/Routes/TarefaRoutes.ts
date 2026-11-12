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
import { podeVerTodosProjetos } from "../../../shared/seguranca/visibilidadeProjetos";
import { papelNoProjeto, podeAtribuirAvulsas, regrasTarefa, RegrasTarefa } from "../../../shared/seguranca/regrasTarefa";
import { ehCategoriaTarefa } from "../../../domain/Enum/CategoriaTarefa";
import { ErroValidacao } from "../../../shared/erros/ErroValidacao";

const SO_QUEM_ORGANIZA = "Só o líder do projeto e a gestão podem fazer isso.";
const SO_GESTAO_AVULSA = "Só a gestão organiza tarefas avulsas.";

/** Tarefas (de projeto e avulsas) e comentários. Quem pode o quê: `regrasTarefa.ts` (sessões 8b e 8c). */
export default class TarefaRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    private async carregar(usuario: UsuarioAutenticado, codigo: string): Promise<{ tarefa: Tarefa; regras: RegrasTarefa }> {
        const tarefa = await this.factory.criarTarefaRepository().buscarPorCodigo(codigo);
        if (!tarefa) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        const projeto = tarefa.projeto ? await this.factory.criarProjetoRepository().buscarPorCodigo(tarefa.projeto.codigo) : null;
        const regras = regrasTarefa(usuario, tarefa, projeto);
        // Avulsa de outra pessoa: para quem não pode ver, a tarefa "não existe".
        if (tarefa.avulsa && !regras.ver) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        return { tarefa, regras };
    }

    private async exigirOrganizar(usuario: UsuarioAutenticado, codigo: string) {
        const r = await this.carregar(usuario, codigo);
        if (!r.regras.organizar) throw new ErroProibido(r.tarefa.avulsa ? SO_GESTAO_AVULSA : SO_QUEM_ORGANIZA);
        return r;
    }

    private async usuarioAtual(usuario: UsuarioAutenticado) {
        return this.factory.criarUsuarioRepository().buscarPorCodigo(usuario.codigo);
    }

    init(): void {
        this.http.route("get", "/tarefas", true, async (_params: any, body: any, query: any) => {
            const usuario = exigirAutenticado(body?.user);
            const minhas = query?.minhas === "true" || query?.minhas === "1";
            if (query?.categoria && query.categoria !== "avulsas" && !ehCategoriaTarefa(query.categoria)) {
                throw new ErroValidacao("Categoria inválida. Use inovacao, capacitacao, execucao ou avulsas.", "CATEGORIA_TAREFA_INVALIDA");
            }
            const tarefas = await new ListarTarefas(this.factory).execute({
                codigoProjeto: query?.codigoProjeto,
                codigoResponsavel: minhas ? usuario.codigo : query?.codigoResponsavel,
                categoria: query?.categoria,
                status: query?.status,
            });
            if (podeVerTodosProjetos(usuario) && podeAtribuirAvulsas(usuario)) return tarefas;
            // Membro: tarefas dos projetos de que participa ou participou, e as (de projeto ou avulsas) em que é responsável.
            const visiveis = new Set(
                (await new ListarProjetos(this.factory).execute({ codigoUsuario: usuario.codigo })).map((p) => p.codigo),
            );
            return tarefas.filter(
                (t) =>
                    t.responsaveis.some((r) => r.codigo === usuario.codigo) ||
                    (t.projeto !== null && (podeVerTodosProjetos(usuario) || visiveis.has(t.projeto.codigo))) ||
                    (t.avulsa && podeAtribuirAvulsas(usuario)),
            );
        });

        this.http.route("post", "/tarefas", true, async (_params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            let codigosResponsaveis: string[] = body.codigosResponsaveis ?? [];
            if (!body.codigoProjeto) {
                // Tarefa avulsa (8c): só a gestão cria; responsáveis = qualquer pessoa ativa.
                if (!podeAtribuirAvulsas(usuario)) throw new ErroProibido("Só a gestão cria tarefas avulsas. Escolha um projeto.");
            } else {
                const projeto = await this.factory.criarProjetoRepository().buscarPorCodigo(body.codigoProjeto);
                const papel = papelNoProjeto(usuario, projeto);
                if (papel === "nenhum") throw new ErroProibido("Você só pode criar tarefas em projetos de cuja equipe faz parte.");
                // Participante cria e fica como responsável; o líder organiza depois.
                if (papel === "participante") codigosResponsaveis = [usuario.codigo];
            }
            return new CriarTarefa(this.factory).execute({
                codigoProjeto: body.codigoProjeto || null,
                categoria: body.categoria || null,
                titulo: body.titulo ?? "",
                dataInicio: new Date(body.dataInicio),
                dataFim: new Date(body.dataFim),
                prioridade: body.prioridade as PrioridadeTarefa,
                descricao: body.descricao ?? null,
                codigosResponsaveis,
                criadaPor: await this.usuarioAtual(usuario),
                codigoIniciativa: body.codigoIniciativa || null,
            });
        });

        this.http.route("put", "/tarefas/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            await this.exigirOrganizar(usuario, params.codigo);
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
                categoria: body.categoria ?? undefined,
                codigoIniciativa: body.codigoIniciativa === undefined ? undefined : body.codigoIniciativa || null,
            });
        });

        this.http.route("patch", "/tarefas/:codigo/status", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            const { regras } = await this.carregar(usuario, params.codigo);
            if (!regras.mudarStatus) {
                throw new ErroProibido("Você só pode concluir ou reabrir tarefas em que é responsável.");
            }
            return new AlterarStatusTarefa(this.factory).execute(
                params.codigo,
                body.status as StatusTarefa,
                new Date(),
                await this.usuarioAtual(usuario),
            );
        });

        this.http.route("delete", "/tarefas/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body.user);
            await this.exigirOrganizar(usuario, params.codigo);
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
            const { tarefa, regras } = await this.carregar(usuario, params.codigo);
            if (!regras.comentar) {
                throw new ErroProibido(
                    tarefa.avulsa
                        ? "Só os responsáveis e a gestão comentam nesta tarefa."
                        : "Só a equipe atual do projeto comenta nas tarefas.",
                );
            }
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
