import CapacitacaoFeedback from "../../../domain/Entity/CapacitacaoFeedback";
import CapacitacaoFeedbackRepositoryInterface from "../../../domain/Interfaces/CapacitacaoFeedbackRepositoryInterface";

export default class CapacitacaoFeedbackRepositoryMemory implements CapacitacaoFeedbackRepositoryInterface {
    private feedbacks: CapacitacaoFeedback[];

    constructor() {
        this.feedbacks = [];
    }

    async criar(feedback: CapacitacaoFeedback): Promise<CapacitacaoFeedback> {
        const jaExiste = this.feedbacks.some(
            (f) =>
                f.capacitacao.codigo === feedback.capacitacao.codigo &&
                f.usuario.codigo === feedback.usuario.codigo,
        );

        if (jaExiste) {
            throw new Error("Já existe feedback deste usuário para a capacitação");
        }

        this.feedbacks.push(feedback);
        return feedback;
    }

    async editar(feedback: CapacitacaoFeedback): Promise<CapacitacaoFeedback> {
        const indice = this.feedbacks.findIndex((f) => f.codigo === feedback.codigo);

        if (indice === -1) {
            throw new Error("Feedback não encontrado");
        }

        this.feedbacks[indice] = feedback;
        return feedback;
    }

    async listar(): Promise<CapacitacaoFeedback[]> {
        return [...this.feedbacks];
    }

    async listarPorUsuario(codigoUsuario: string): Promise<CapacitacaoFeedback[]> {
        return this.feedbacks.filter((f) => f.usuario.codigo === codigoUsuario);
    }

    async buscarPorCapacitacaoEUsuario(
        codigoCapacitacao: string,
        codigoUsuario: string,
    ): Promise<CapacitacaoFeedback | null> {
        return (
            this.feedbacks.find(
                (f) =>
                    f.capacitacao.codigo === codigoCapacitacao &&
                    f.usuario.codigo === codigoUsuario,
            ) ?? null
        );
    }
}
