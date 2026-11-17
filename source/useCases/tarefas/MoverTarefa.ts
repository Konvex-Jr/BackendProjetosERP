import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/entity/Tarefa";
import Usuario from "../../domain/entity/Usuario";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { hoje as hojeNoFuso } from "../../shared/datas";
import { colunaDoProjeto } from "./colunaDoProjeto";

/** Leva a tarefa para uma coluna do quadro do projeto; o status vem do papel da coluna. */
export default class MoverTarefa {
    private readonly tarefas;
    private readonly projetos;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
        this.projetos = factory.criarProjetoRepository();
    }
    async execute(codigo: string, codigoColuna: string, hoje = hojeNoFuso(), quem: Usuario | null = null): Promise<Tarefa> {
        const t = await this.tarefas.buscarPorCodigo(codigo);
        if (!t) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        if (!t.projeto) throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.AVULSA_SEM_COLUNA, "TAREFA_AVULSA_SEM_COLUNA");
        const projeto = await this.projetos.buscarPorCodigo(t.projeto.codigo);
        if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
        const movida = t.naColuna(colunaDoProjeto(projeto, codigoColuna), hoje, quem);
        movida.exigirConclusaoCoerente();
        return this.tarefas.editar(movida);
    }
}
