import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/Entity/Tarefa";
import StatusTarefa from "../../domain/Enum/StatusTarefa";
import Usuario from "../../domain/Entity/Usuario";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class AlterarStatusTarefa {
    private readonly tarefas;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigo: string, status: StatusTarefa, hoje = new Date(), quem: Usuario | null = null): Promise<Tarefa> {
        const t = await this.tarefas.buscarPorCodigo(codigo);
        if (!t)
            throw new ErroNaoEncontrado("Tarefa não encontrada.");
        const concluida = status === StatusTarefa.CONCLUIDA;
        const jaConcluida = t.status === StatusTarefa.CONCLUIDA;
        // Se já estava concluída, mantém data e autor originais.
        const editada = t.comStatus(status, concluida ? (jaConcluida ? t.dataConclusao : hoje) : null,
            concluida ? (jaConcluida ? t.concluidaPor : quem) : null);
        return this.tarefas.editar(editada);
    }
}
