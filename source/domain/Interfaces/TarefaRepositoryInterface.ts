import Tarefa from "../Entity/Tarefa";

export default interface TarefaRepositoryInterface {
    criar(tarefa: Tarefa): Promise<Tarefa>;
    listar(): Promise<Tarefa[]>;
    listarPorProjeto(codigoProjeto: string): Promise<Tarefa[]>;
    listarPorResponsavel(codigoUsuario: string): Promise<Tarefa[]>;
    buscarPorCodigo(codigo: string): Promise<Tarefa | null>;
    editar(tarefa: Tarefa): Promise<Tarefa>;
    excluir(codigo: string): Promise<void>;
    excluirPorProjeto(codigoProjeto: string): Promise<void>;
}
