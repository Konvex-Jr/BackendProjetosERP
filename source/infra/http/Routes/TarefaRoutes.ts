import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import PrioridadeTarefa from "../../../domain/Enum/PrioridadeTarefa";
import StatusTarefa from "../../../domain/Enum/StatusTarefa";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarTarefas from "../../../useCases/ListarTarefas/ListarTarefas";
import CriarTarefa from "../../../useCases/CriarTarefa/CriarTarefa";
import EditarTarefa from "../../../useCases/EditarTarefa/EditarTarefa";
import AlterarStatusTarefa from "../../../useCases/AlterarStatusTarefa/AlterarStatusTarefa";
import ExcluirTarefa from "../../../useCases/ExcluirTarefa/ExcluirTarefa";

export default class TarefaRoutes implements ModelRoutes {
    constructor(private readonly http: Http, private readonly factory: RepositoryFactoryInterface) {}

    init(): void {
        this.http.route("get", "/tarefas", true, async (_params: any, _body: any, query: any) =>
            new ListarTarefas(this.factory).execute({
                codigoProjeto: query?.codigoProjeto,
                codigoResponsavel: query?.codigoResponsavel,
            }));

        this.http.route("post", "/tarefas", true, async (_params: any, body: any) =>
            new CriarTarefa(this.factory).execute({
                codigoProjeto: body.codigoProjeto,
                titulo: body.titulo,
                dataInicio: new Date(body.dataInicio),
                dataFim: new Date(body.dataFim),
                prioridade: body.prioridade as PrioridadeTarefa,
                descricao: body.descricao ?? null,
                codigosResponsaveis: body.codigosResponsaveis ?? [],
            }));

        this.http.route("put", "/tarefas/:codigo", true, async (params: any, body: any) =>
            new EditarTarefa(this.factory).execute({
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
            }));

        this.http.route("patch", "/tarefas/:codigo/status", true, async (params: any, body: any) =>
            new AlterarStatusTarefa(this.factory).execute(params.codigo, body.status as StatusTarefa));

        this.http.route("delete", "/tarefas/:codigo", true, async (params: any) =>
            new ExcluirTarefa(this.factory).execute(params.codigo));
    }
}
