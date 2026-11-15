import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import SigiloBiblioteca from "../../domain/enum/SigiloBiblioteca";
import { DonoAnexo } from "../../domain/enum/Anexo";
import GerirAnexos from "../anexos/GerirAnexos";
import ExcluirItemBiblioteca from "../biblioteca/ExcluirItemBiblioteca";

export default class ExcluirProjeto {
    private readonly projetos;
    private readonly tarefas;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigo: string): Promise<void> {
        if (!(await this.projetos.buscarPorCodigo(codigo))) throw new ErroNaoEncontrado("Projeto não encontrado.");
        // Itens só da equipe saem com anexos e arquivos; os demais ficam, sem projeto.
        const biblioteca = this.factory.criarBibliotecaRepository();
        const excluirItem = new ExcluirItemBiblioteca(this.factory);
        for (const item of await biblioteca.listar({ codigoProjeto: codigo, sigilo: SigiloBiblioteca.PROJETO })) {
            await excluirItem.removerComAnexos(item.codigo);
        }
        await biblioteca.desligarProjeto(codigo);
        const codigosTarefas = (await this.tarefas.listarPorProjeto(codigo)).map((t) => t.codigo);
        await new GerirAnexos(this.factory).excluirDosDonos(DonoAnexo.TAREFA, codigosTarefas);
        await this.tarefas.excluirPorProjeto(codigo);
        await this.projetos.excluir(codigo);
    }
}
