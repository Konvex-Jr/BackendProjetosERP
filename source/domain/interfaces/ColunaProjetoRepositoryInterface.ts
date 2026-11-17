import ColunaProjeto from "../entity/ColunaProjeto";
import Usuario from "../entity/Usuario";

/** Colunas do kanban de um projeto. A leitura vem junto com o projeto; aqui só a gravação do quadro. */
export default interface ColunaProjetoRepositoryInterface {
    /**
     * Troca as colunas do projeto pela lista (na ordem), move as tarefas das colunas removidas para o destino
     * (`destinos`: código da removida, código do destino) e acerta status e conclusão de TODAS as tarefas do
     * projeto pelo papel atual da coluna delas, na hora da gravação (o que outra pessoa moveu no meio do caminho
     * também é acertado). Uma transação. Coluna removida que ainda tem tarefa = ErroConflito `QUADRO_MUDOU`.
     * `novas`: códigos das colunas que ainda não existem. Qualquer outra coluna da lista tem de estar entre as atuais
     * do projeto na hora da gravação; se não estiver (outra pessoa a excluiu), também `QUADRO_MUDOU`.
     */
    substituir(
        codigoProjeto: string,
        colunas: ColunaProjeto[],
        destinos: Map<string, string>,
        hoje: Date,
        quem: Usuario | null,
        novas?: ReadonlySet<string>,
    ): Promise<void>;
}
