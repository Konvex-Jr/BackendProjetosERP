import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import ExcluirPasta from "../ExcluirPasta/ExcluirPasta";

export default class ExcluirProjeto {
    private readonly projetos;
    private readonly tarefas;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigo: string): Promise<void> {
        if (!(await this.projetos.buscarPorCodigo(codigo))) throw new ErroNaoEncontrado("Projeto não encontrado.");
        // As pastas da equipe do projeto saem junto; antes, apaga os arquivos anexados (sessão 12c).
        const pastas = (await this.factory.criarPastaRepository().listar()).filter((p) => p.projeto?.codigo === codigo);
        for (const pasta of pastas) await new ExcluirPasta(this.factory).execute(pasta.codigo);
        await this.tarefas.excluirPorProjeto(codigo);
        await this.projetos.excluir(codigo);
    }
}
