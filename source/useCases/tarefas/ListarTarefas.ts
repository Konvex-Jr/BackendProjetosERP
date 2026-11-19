import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/entity/Tarefa";

export interface FiltroTarefas {
    codigoProjeto?: string;
    codigoResponsavel?: string;
    status?: string;
}

export default class ListarTarefas {
    private readonly tarefas;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(filtro: FiltroTarefas = {}): Promise<Tarefa[]> {
        let lista: Tarefa[];
        if (filtro.codigoProjeto) lista = await this.tarefas.listarPorProjeto(filtro.codigoProjeto);
        else if (filtro.codigoResponsavel) lista = await this.tarefas.listarPorResponsavel(filtro.codigoResponsavel);
        else lista = await this.tarefas.listar();
        return lista.filter(
            (t) =>
                (!filtro.codigoResponsavel || t.responsaveis.some((r) => r.codigo === filtro.codigoResponsavel)) &&
                (!filtro.status || t.status === filtro.status),
        );
    }
}
