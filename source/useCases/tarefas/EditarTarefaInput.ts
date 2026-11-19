import StatusTarefa from "../../domain/enum/StatusTarefa";
import PrioridadeTarefa from "../../domain/enum/PrioridadeTarefa";
import Usuario from "../../domain/entity/Usuario";
export default interface EditarTarefaInput {
    codigo: string;
    titulo: string;
    dataInicio: Date;
    dataFim: Date;
    status: StatusTarefa;
    prioridade: PrioridadeTarefa;
    /** Se vier, a coluna vale mais que o `status`. */
    codigoColuna?: string | null;
    descricao?: string | null;
    codigosResponsaveis: string[];
    codigoDependencia?: string | null;
    checklist?: EditarTarefaChecklistInput[];
    /** Quem está editando; vira `concluidaPor` se a edição concluir a tarefa. */
    quem?: Usuario | null;
}

export interface EditarTarefaChecklistInput {
    codigo?: string;
    texto: string;
    feito: boolean;
}
