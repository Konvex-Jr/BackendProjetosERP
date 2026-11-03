import PrioridadeTarefa from "../../domain/Enum/PrioridadeTarefa";
import CategoriaTarefa from "../../domain/Enum/CategoriaTarefa";
import Usuario from "../../domain/Entity/Usuario";
export default interface CriarTarefaInput {
    /** Tarefa de projeto. Informe projeto OU categoria (sessão 8c). */
    codigoProjeto?: string | null;
    /** Tarefa avulsa: inovacao, capacitacao ou execucao. */
    categoria?: CategoriaTarefa | null;
    titulo: string;
    dataInicio: Date;
    dataFim: Date;
    prioridade?: PrioridadeTarefa;
    descricao?: string | null;
    codigosResponsaveis?: string[];
    criadaPor?: Usuario | null;
    /** Só em tarefa de Inovação (sessão 12b). */
    codigoIniciativa?: string | null;
}
