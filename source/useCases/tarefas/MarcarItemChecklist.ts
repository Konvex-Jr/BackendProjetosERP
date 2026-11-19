import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/entity/Tarefa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

/** Marca ou desmarca um item do checklist na hora, sem passar pelo "Salvar" da tarefa. */
export default class MarcarItemChecklist {
    private readonly tarefas;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigoTarefa: string, codigoItem: string, feito: boolean): Promise<Tarefa> {
        if (typeof feito !== "boolean") throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.FEITO_INVALIDO, "FEITO_INVALIDO");
        const tarefa = await this.tarefas.buscarPorCodigo(codigoTarefa);
        if (!tarefa) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        // Conferir antes evita levar um código que não é UUID até o banco.
        if (!tarefa.checklist.some((i) => i.codigo === codigoItem))
            throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.TAREFA.ITEM_NAO_ENCONTRADO);
        if (!(await this.tarefas.marcarItem(codigoTarefa, codigoItem, feito)))
            throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.TAREFA.ITEM_NAO_ENCONTRADO);
        return (await this.tarefas.buscarPorCodigo(codigoTarefa))!;
    }
}
