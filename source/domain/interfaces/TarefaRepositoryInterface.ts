import Tarefa from "../entity/Tarefa";

export interface ContagemTarefas {
    total: number;
    concluidas: number;
    /** Não concluídas com prazo anterior a hoje. */
    atrasadas: number;
    /** Não concluídas com prazo de hoje até o domingo da semana. */
    semana: number;
}

/** Tarefas (sempre de um projeto). Não aplica permissão: quem decide o que a pessoa vê é regrasTarefa. */
export default interface TarefaRepositoryInterface {
    criar(tarefa: Tarefa): Promise<Tarefa>;
    listar(): Promise<Tarefa[]>;
    listarPorProjeto(codigoProjeto: string): Promise<Tarefa[]>;
    /** Só os códigos das tarefas do projeto, sem montar entidades (não revalida as tarefas). */
    listarCodigosPorProjeto(codigoProjeto: string): Promise<string[]>;
    /** Contagens por projeto (sem permissão: o progresso é igual para quem vê o projeto). `hoje` é o dia de São Paulo. */
    contarPorProjetos(codigosProjetos: string[], hoje: Date): Promise<Map<string, ContagemTarefas>>;
    listarPorResponsavel(codigoUsuario: string): Promise<Tarefa[]>;
    buscarPorCodigo(codigo: string): Promise<Tarefa | null>;
    editar(tarefa: Tarefa): Promise<Tarefa>;
    /** Marca ou desmarca um item do checklist sem regravar a tarefa. Falso se o item não é dessa tarefa. */
    marcarItem(codigoTarefa: string, codigoItem: string, feito: boolean): Promise<boolean>;
    excluir(codigo: string): Promise<void>;
    excluirPorProjeto(codigoProjeto: string): Promise<void>;
}
