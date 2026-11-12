import PrioridadeTarefa from "../../domain/enum/PrioridadeTarefa";
import CategoriaTarefa from "../../domain/enum/CategoriaTarefa";
import Usuario from "../../domain/entity/Usuario";
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
