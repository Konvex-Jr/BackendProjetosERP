import CapacitacaoFeedback from "../entity/CapacitacaoFeedback";

export interface ResumoAvaliacao {
    media: number | null;
    total: number;
}

/** Avaliações de capacitações: no máximo uma por pessoa em cada capacitação. */
export default interface CapacitacaoFeedbackRepositoryInterface {
    /** Cria ou substitui a avaliação da pessoa nesta capacitação. */
    salvar(feedback: CapacitacaoFeedback): Promise<CapacitacaoFeedback>;
    listarPorCapacitacao(codigoCapacitacao: string): Promise<CapacitacaoFeedback[]>;
    buscarPorCapacitacaoEUsuario(codigoCapacitacao: string, codigoUsuario: string): Promise<CapacitacaoFeedback | null>;
    resumos(codigosCapacitacoes: string[]): Promise<Map<string, ResumoAvaliacao>>;
}
