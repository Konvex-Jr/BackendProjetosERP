import ComentarioTarefa from "../entity/ComentarioTarefa";

/** Comentários das tarefas. Quem comenta vem de regrasTarefa; apagar, só o autor ou quem organiza a tarefa (TarefaRoutes). */
export default interface ComentarioTarefaRepositoryInterface {
    criar(comentario: ComentarioTarefa): Promise<ComentarioTarefa>;
    /** Do mais antigo para o mais novo. */
    listarPorTarefa(codigoTarefa: string): Promise<ComentarioTarefa[]>;
    buscarPorCodigo(codigo: string): Promise<ComentarioTarefa | null>;
    excluir(codigo: string): Promise<void>;
}
