import Projeto from "../../domain/entity/Projeto";
import Tarefa from "../../domain/entity/Tarefa";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { regrasTarefa, RegrasTarefa } from "../../shared/seguranca/regrasTarefa";

/**
 * Carga comum das rotas de tarefa e dos anexos de tarefa: a tarefa, o projeto atual (com equipe e líder)
 * e as regras da pessoa. Só lança se a tarefa não existe; quem chama decide o que fazer sem `regras.ver`
 * (as rotas de tarefa dão 404 só na avulsa; os anexos dão 404 sempre).
 */
export async function carregarTarefa(
    factory: RepositoryFactoryInterface,
    usuario: UsuarioAutenticado,
    codigo: string,
): Promise<{ tarefa: Tarefa; projeto: Projeto | null; regras: RegrasTarefa }> {
    const tarefa = await factory.criarTarefaRepository().buscarPorCodigo(codigo);
    if (!tarefa) throw new ErroNaoEncontrado("Tarefa não encontrada.");
    const projeto = tarefa.projeto ? await factory.criarProjetoRepository().buscarPorCodigo(tarefa.projeto.codigo) : null;
    return { tarefa, projeto, regras: regrasTarefa(usuario, tarefa, projeto) };
}
