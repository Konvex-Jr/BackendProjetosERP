import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import SigiloBiblioteca from "../../domain/enum/SigiloBiblioteca";
import { DonoAnexo } from "../../domain/enum/Anexo";
import GerirAnexos from "../anexos/GerirAnexos";
import ExcluirItemBiblioteca from "../biblioteca/ExcluirItemBiblioteca";
import { exigirNaoGeral } from "./sincronizarGeral";

export default class ExcluirProjeto {
    private readonly projetos;
    private readonly tarefas;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
        this.tarefas = factory.criarTarefaRepository();
    }
    async execute(codigo: string): Promise<void> {
        const projeto = await this.projetos.buscarPorCodigo(codigo);
        if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
        exigirNaoGeral(projeto);
        // Só os códigos: montar as tarefas revalida cada uma e pode falhar (responsável que já saiu da equipe).
        // Vem antes da Biblioteca, para que uma falha aqui não a deixe pela metade.
        const codigosTarefas = await this.tarefas.listarCodigosPorProjeto(codigo);
        await new GerirAnexos(this.factory).excluirDosDonos(DonoAnexo.TAREFA, codigosTarefas);
        // Itens só da equipe saem com anexos e arquivos; os demais ficam, sem projeto.
        const biblioteca = this.factory.criarBibliotecaRepository();
        const excluirItem = new ExcluirItemBiblioteca(this.factory);
        for (const item of await biblioteca.listar({ codigoProjeto: codigo, sigilo: SigiloBiblioteca.PROJETO })) {
            await excluirItem.removerComAnexos(item.codigo);
        }
        await biblioteca.desligarProjeto(codigo);
        await this.tarefas.excluirPorProjeto(codigo);
        await this.projetos.excluir(codigo);
    }
}
