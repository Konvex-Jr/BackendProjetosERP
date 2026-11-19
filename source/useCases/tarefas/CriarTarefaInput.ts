import PrioridadeTarefa from "../../domain/enum/PrioridadeTarefa";
import DificuldadeTarefa from "../../domain/enum/DificuldadeTarefa";
import Usuario from "../../domain/entity/Usuario";
export default interface CriarTarefaInput {
    /** Obrigatório: toda tarefa tem projeto (sem ele, PROJETO_OBRIGATORIO). */
    codigoProjeto?: string | null;
    titulo: string;
    dataInicio: Date;
    dataFim: Date;
    prioridade?: PrioridadeTarefa;
    descricao?: string | null;
    codigosResponsaveis?: string[];
    /** Coluna do quadro onde a tarefa nasce (padrão: a de entrada). */
    codigoColuna?: string | null;
    dificuldade?: DificuldadeTarefa | null;
    criadaPor?: Usuario | null;
}
