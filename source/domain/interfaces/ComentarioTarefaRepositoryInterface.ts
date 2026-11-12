import ComentarioTarefa from "../entity/ComentarioTarefa";

export default interface ComentarioTarefaRepositoryInterface {
    criar(comentario: ComentarioTarefa): Promise<ComentarioTarefa>;
    /** Do mais antigo para o mais novo. */
    listarPorTarefa(codigoTarefa: string): Promise<ComentarioTarefa[]>;
    buscarPorCodigo(codigo: string): Promise<ComentarioTarefa | null>;
    excluir(codigo: string): Promise<void>;
}
