import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/Entity/Tarefa";

export default class ListarTarefas {
    private readonly tarefas;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(filtro: {
        codigoProjeto?: string;
        codigoResponsavel?: string;
    } = {}): Promise<Tarefa[]> {
        if (filtro.codigoProjeto)
            return this.tarefas.listarPorProjeto(filtro.codigoProjeto);
        if (filtro.codigoResponsavel)
            return this.tarefas.listarPorResponsavel(filtro.codigoResponsavel);
        return this.tarefas.listar();
    }
}
