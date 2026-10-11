import StatusTarefa from "../../domain/Enum/StatusTarefa";
import PrioridadeTarefa from "../../domain/Enum/PrioridadeTarefa";
export default interface CriarTarefaInput {
    codigoProjeto: string;
    titulo: string;
    dataInicio: Date;
    dataFim: Date;
    prioridade?: PrioridadeTarefa;
    descricao?: string | null;
    codigosResponsaveis?: string[];
}
