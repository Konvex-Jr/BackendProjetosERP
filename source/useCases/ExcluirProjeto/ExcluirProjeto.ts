import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class ExcluirProjeto {
    private readonly projetos;
    private readonly tarefas;
    constructor(factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigo: string): Promise<void> {
        if (!(await this.projetos.buscarPorCodigo(codigo)))
            throw new ErroNaoEncontrado("Projeto não encontrado.");
        await this.tarefas.excluirPorProjeto(codigo);
        await this.projetos.excluir(codigo);
    }
}
