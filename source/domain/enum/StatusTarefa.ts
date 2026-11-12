/** Colunas do kanban de tarefas. Concluir exige data de conclusão (validado na entidade Tarefa). */
enum StatusTarefa {
    PENDENTE = "pendente",
    ANDAMENTO = "andamento",
    CONCLUIDA = "concluida",
}

export default StatusTarefa;
