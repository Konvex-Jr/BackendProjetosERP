import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/Entity/Tarefa";
import StatusTarefa from "../../domain/Enum/StatusTarefa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class AlterarStatusTarefa {
    private readonly tarefas;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigo: string, status: StatusTarefa, hoje = new Date()): Promise<Tarefa> {
        const t = await this.tarefas.buscarPorCodigo(codigo);
        if (!t)
            throw new ErroNaoEncontrado("Tarefa não encontrada.");
        const concluida = status === StatusTarefa.CONCLUIDA;
        const editada = new Tarefa(t.projeto, t.titulo, t.dataInicio, t.dataFim, status, t.prioridade, t.descricao, concluida ? hoje : null, t.dependeDe, t.responsaveis, t.checklist, t.codigo);
        return this.tarefas.editar(editada);
    }
}
