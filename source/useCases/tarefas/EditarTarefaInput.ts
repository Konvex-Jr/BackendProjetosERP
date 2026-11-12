import StatusTarefa from "../../domain/enum/StatusTarefa";
import PrioridadeTarefa from "../../domain/enum/PrioridadeTarefa";
import Usuario from "../../domain/entity/Usuario";
import CategoriaTarefa from "../../domain/enum/CategoriaTarefa";
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
    /** Iniciativa ligada (sessão 12b): ausente mantém a atual; vazio ou null desliga. */
    codigoIniciativa?: string | null;
}

export interface EditarTarefaChecklistInput {
    codigo?: string;
    texto: string;
    feito: boolean;
}
