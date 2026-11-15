import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { DonoAnexo } from "../../domain/enum/Anexo";
import GerirAnexos from "../anexos/GerirAnexos";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class ExcluirTarefa {
    private readonly tarefas;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigo: string): Promise<void> {
        if (!(await this.tarefas.buscarPorCodigo(codigo))) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        // Anexos não têm chave estrangeira: saem aqui, com os arquivos, antes da tarefa.
        await new GerirAnexos(this.factory).excluirDosDonos(DonoAnexo.TAREFA, [codigo]);
        await this.tarefas.excluir(codigo);
    }
}
