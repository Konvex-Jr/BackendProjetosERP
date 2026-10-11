import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class ExcluirTarefa {
    private readonly tarefas;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigo: string): Promise<void> {
        if (!(await this.tarefas.buscarPorCodigo(codigo)))
            throw new ErroNaoEncontrado("Tarefa não encontrada.");
        await this.tarefas.excluir(codigo);
    }
}
