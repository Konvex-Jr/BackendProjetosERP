import Tarefa from "../../../domain/Entity/Tarefa";
import TarefaRepositoryInterface from "../../../domain/Interfaces/TarefaRepositoryInterface";

export default class TarefaRepositoryMemory implements TarefaRepositoryInterface {
    private tarefas: Tarefa[];

    constructor() {
        this.tarefas = [];
    }

    async criar(tarefa: Tarefa): Promise<Tarefa> {
        this.tarefas.push(tarefa);
        return tarefa;
    }

    async listar(): Promise<Tarefa[]> {
        return [...this.tarefas];
    }

    async listarPorProjeto(codigoProjeto: string): Promise<Tarefa[]> {
        return this.tarefas.filter((t) => t.projeto.codigo === codigoProjeto);
    }

    async listarPorResponsavel(codigoUsuario: string): Promise<Tarefa[]> {
        return this.tarefas.filter((t) =>
            t.responsaveis.some((r) => r.codigo === codigoUsuario),
        );
    }

    async buscarPorCodigo(codigo: string): Promise<Tarefa | null> {
        return this.tarefas.find((t) => t.codigo === codigo) ?? null;
    }

    async editar(tarefa: Tarefa): Promise<Tarefa> {
        const indice = this.tarefas.findIndex((t) => t.codigo === tarefa.codigo);

        if (indice === -1) {
            throw new Error("Tarefa não encontrada");
        }

        this.tarefas[indice] = tarefa;
        return tarefa;
    }

    async excluir(codigo: string): Promise<void> {
        const indice = this.tarefas.findIndex((t) => t.codigo === codigo);

        if (indice === -1) {
            throw new Error("Tarefa não encontrada");
        }

        this.tarefas.splice(indice, 1);
        this.tarefas = this.tarefas.map((t) =>
            t.dependeDe?.codigo === codigo ? this.semDependencia(t) : t,
        );
    }

    async excluirPorProjeto(codigoProjeto: string): Promise<void> {
        this.tarefas = this.tarefas.filter((t) => t.projeto.codigo !== codigoProjeto);
    }

    private semDependencia(tarefa: Tarefa): Tarefa {
        return new Tarefa(
            tarefa.projeto,
            tarefa.titulo,
            tarefa.dataInicio,
            tarefa.dataFim,
            tarefa.status,
            tarefa.prioridade,
            tarefa.descricao,
            tarefa.dataConclusao,
            null,
            tarefa.responsaveis,
            tarefa.checklist,
            tarefa.codigo,
        );
    }
}
