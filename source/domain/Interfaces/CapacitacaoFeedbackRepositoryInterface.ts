import CapacitacaoFeedback from "../Entity/CapacitacaoFeedback";

export default interface CapacitacaoFeedbackRepositoryInterface {
    criar(feedback: CapacitacaoFeedback): Promise<CapacitacaoFeedback>;
    editar(feedback: CapacitacaoFeedback): Promise<CapacitacaoFeedback>;
    listar(): Promise<CapacitacaoFeedback[]>;
    listarPorUsuario(codigoUsuario: string): Promise<CapacitacaoFeedback[]>;
    buscarPorCapacitacaoEUsuario(
        codigoCapacitacao: string,
        codigoUsuario: string,
    ): Promise<CapacitacaoFeedback | null>;
}
