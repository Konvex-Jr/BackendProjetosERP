import StatusTarefa from "../../../domain/enum/StatusTarefa";
import Tarefa from "../../../domain/entity/Tarefa";
import TarefaRepositoryInterface, { ContagemTarefas } from "../../../domain/interfaces/TarefaRepositoryInterface";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

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
        return this.tarefas.filter((t) => t.projeto?.codigo === codigoProjeto);
    }

    async contarPorProjetos(codigosProjetos: string[]): Promise<Map<string, ContagemTarefas>> {
        const mapa = new Map<string, ContagemTarefas>(codigosProjetos.map((c) => [c, { total: 0, concluidas: 0 }]));
        for (const t of this.tarefas) {
            const contagem = t.projeto ? mapa.get(t.projeto.codigo) : undefined;
            if (!contagem) continue;
            contagem.total++;
            if (t.status === StatusTarefa.CONCLUIDA) contagem.concluidas++;
        }
        return mapa;
    }

    async listarPorResponsavel(codigoUsuario: string): Promise<Tarefa[]> {
        return this.tarefas.filter((t) => t.responsaveis.some((r) => r.codigo === codigoUsuario));
    }

    async buscarPorCodigo(codigo: string): Promise<Tarefa | null> {
        return this.tarefas.find((t) => t.codigo === codigo) ?? null;
    }

    async editar(tarefa: Tarefa): Promise<Tarefa> {
        const indice = this.tarefas.findIndex((t) => t.codigo === tarefa.codigo);

        if (indice === -1) {
            throw new ErroNaoEncontrado("Tarefa não encontrada.");
        }

        this.tarefas[indice] = tarefa;
        return tarefa;
    }

    async excluir(codigo: string): Promise<void> {
        const indice = this.tarefas.findIndex((t) => t.codigo === codigo);

        if (indice === -1) {
            throw new ErroNaoEncontrado("Tarefa não encontrada.");
        }

        this.tarefas.splice(indice, 1);
        this.tarefas = this.tarefas.map((t) => (t.dependeDe?.codigo === codigo ? t.semDependencia() : t));
    }

    async excluirPorProjeto(codigoProjeto: string): Promise<void> {
        this.tarefas = this.tarefas.filter((t) => t.projeto?.codigo !== codigoProjeto);
    }
}
