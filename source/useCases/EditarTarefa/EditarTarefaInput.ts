import StatusTarefa from "../../domain/Enum/StatusTarefa";
import PrioridadeTarefa from "../../domain/Enum/PrioridadeTarefa";
import Usuario from "../../domain/Entity/Usuario";
import CategoriaTarefa from "../../domain/Enum/CategoriaTarefa";
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
    /** Quem está editando; vira `concluidaPor` se a edição concluir a tarefa. */
    quem?: Usuario | null;
    /** Só para tarefa avulsa: nova categoria (ignorada em tarefa de projeto). */
    categoria?: CategoriaTarefa | null;
}

export interface EditarTarefaChecklistInput {
    codigo?: string;
    texto: string;
    feito: boolean;
}
