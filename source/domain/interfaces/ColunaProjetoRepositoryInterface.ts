import ColunaProjeto from "../entity/ColunaProjeto";
import Tarefa from "../entity/Tarefa";

/** Colunas do kanban de um projeto. A leitura vem junto com o projeto; aqui só a gravação do quadro. */
export default interface ColunaProjetoRepositoryInterface {
    /**
     * Troca as colunas do projeto pela lista (na ordem) e regrava coluna, status e conclusão das tarefas dadas.
     * Uma transação: ou grava tudo ou nada. Coluna que sai com tarefa dentro (que não foi movida) = ErroConflito `QUADRO_MUDOU`.
     */
    substituir(codigoProjeto: string, colunas: ColunaProjeto[], tarefas: Tarefa[]): Promise<void>;
}
