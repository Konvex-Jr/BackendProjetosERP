import StatusTarefa from "../../domain/Enum/StatusTarefa";
import PrioridadeTarefa from "../../domain/Enum/PrioridadeTarefa";
export default interface EditarTarefaInput {
    codigo: string;
    titulo: string;
    dataInicio: Date;
    dataFim: Date;
    status: StatusTarefa;
    prioridade: PrioridadeTarefa;
    descricao?: string | null;
    codigosResponsaveis: string[];
    codigoDependencia?: string | null;
    checklist?: EditarTarefaChecklistInput[];
}

export interface EditarTarefaChecklistInput {
    codigo?: string;
    texto: string;
    feito: boolean;
}
