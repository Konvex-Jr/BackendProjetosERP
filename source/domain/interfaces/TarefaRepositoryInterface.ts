import Tarefa from "../entity/Tarefa";

export interface ContagemTarefas {
    total: number;
    concluidas: number;
}

/** Tarefas de projeto e avulsas. Não aplica permissão: quem decide o que a pessoa vê é regrasTarefa. */
export default interface TarefaRepositoryInterface {
    criar(tarefa: Tarefa): Promise<Tarefa>;
    listar(): Promise<Tarefa[]>;
    listarPorProjeto(codigoProjeto: string): Promise<Tarefa[]>;
    /** Total e concluídas por projeto (sem permissão: o progresso é igual para quem vê o projeto). */
    contarPorProjetos(codigosProjetos: string[]): Promise<Map<string, ContagemTarefas>>;
    listarPorResponsavel(codigoUsuario: string): Promise<Tarefa[]>;
    buscarPorCodigo(codigo: string): Promise<Tarefa | null>;
    editar(tarefa: Tarefa): Promise<Tarefa>;
    excluir(codigo: string): Promise<void>;
    excluirPorProjeto(codigoProjeto: string): Promise<void>;
}
