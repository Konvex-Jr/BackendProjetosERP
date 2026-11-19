/** RF-021. "em_execucao" é exibido como "Em andamento". */
enum StatusProjeto {
    EM_EXECUCAO = "em_execucao",
    ATENCAO = "atencao",
    BLOQUEADO = "bloqueado",
    CONCLUIDO = "concluido",
    ARQUIVADO = "arquivado",
}

/** Status que contam como "projeto ativo" (QA-35, proposta); a ocupação semanal usa outra regra: só exclui concluído e arquivado. */
export const STATUS_PROJETO_ATIVO: StatusProjeto[] = [StatusProjeto.EM_EXECUCAO, StatusProjeto.ATENCAO, StatusProjeto.BLOQUEADO];

export default StatusProjeto;
