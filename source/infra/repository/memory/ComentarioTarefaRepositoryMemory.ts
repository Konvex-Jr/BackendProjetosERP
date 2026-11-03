import ComentarioTarefa from "../../../domain/Entity/ComentarioTarefa";
import ComentarioTarefaRepositoryInterface from "../../../domain/Interfaces/ComentarioTarefaRepositoryInterface";

export default class ComentarioTarefaRepositoryMemory implements ComentarioTarefaRepositoryInterface {
    private comentarios: ComentarioTarefa[] = [];

    async criar(comentario: ComentarioTarefa): Promise<ComentarioTarefa> {
        this.comentarios.push(comentario);
        return comentario;
    }

    async listarPorTarefa(codigoTarefa: string): Promise<ComentarioTarefa[]> {
        return this.comentarios
            .filter((c) => c.codigoTarefa === codigoTarefa)
            .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
    }

    async buscarPorCodigo(codigo: string): Promise<ComentarioTarefa | null> {
        return this.comentarios.find((c) => c.codigo === codigo) ?? null;
    }

    async excluir(codigo: string): Promise<void> {
        this.comentarios = this.comentarios.filter((c) => c.codigo !== codigo);
    }
}
