import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import SigiloBiblioteca from "../../domain/enum/SigiloBiblioteca";
import { DonoAnexo } from "../../domain/enum/Anexo";
import GerirAnexos from "../anexos/GerirAnexos";
import ExcluirItemBiblioteca from "../biblioteca/ExcluirItemBiblioteca";

/**
 * Exclui o projeto com o que depende dele: anexos das tarefas, tarefas, itens da Biblioteca só da
 * equipe (com anexos) e a ligação dos demais itens. Colunas e equipe saem em cascata no banco.
 * Não confere permissão nem se é o geral: quem chama já decidiu (ExcluirProjeto, SalvarArea).
 */
export async function excluirDadosDoProjeto(factory: RepositoryFactoryInterface, codigo: string): Promise<void> {
    const tarefas = factory.criarTarefaRepository();
    // Só os códigos: montar as tarefas revalida cada uma e pode falhar (responsável que já saiu da equipe).
    // Vem antes da Biblioteca, para que uma falha aqui não a deixe pela metade.
    const codigosTarefas = await tarefas.listarCodigosPorProjeto(codigo);
    await new GerirAnexos(factory).excluirDosDonos(DonoAnexo.TAREFA, codigosTarefas);
    // Itens só da equipe saem com anexos e arquivos; os demais ficam, sem projeto.
    const biblioteca = factory.criarBibliotecaRepository();
    const excluirItem = new ExcluirItemBiblioteca(factory);
    for (const item of await biblioteca.listar({ codigoProjeto: codigo, sigilo: SigiloBiblioteca.PROJETO })) {
        await excluirItem.removerComAnexos(item.codigo);
    }
    await biblioteca.desligarProjeto(codigo);
    await tarefas.excluirPorProjeto(codigo);
    await factory.criarProjetoRepository().excluir(codigo);
}
