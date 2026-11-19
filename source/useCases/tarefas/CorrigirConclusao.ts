import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/entity/Tarefa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { hoje as hojeNoFuso } from "../../shared/datas";

/** Corrige a data em que a tarefa foi concluída (esquecimento de marcar na hora). Quem concluiu não muda. */
export default class CorrigirConclusao {
    private readonly tarefas;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigo: string, data: Date, hoje = hojeNoFuso()): Promise<Tarefa> {
        const tarefa = await this.tarefas.buscarPorCodigo(codigo);
        if (!tarefa) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        return this.tarefas.editar(tarefa.comDataConclusao(data, hoje));
    }
}
