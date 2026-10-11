import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import CapacitacaoFeedback from "../../domain/Entity/CapacitacaoFeedback";

export default class ListarFeedbacks {
    private readonly feedbacks;
    constructor(factory: RepositoryFactoryInterface) {
        this.feedbacks = factory.criarCapacitacaoFeedbackRepository();
    }
    async execute(codigoUsuario?: string): Promise<CapacitacaoFeedback[]> {
        return codigoUsuario ? this.feedbacks.listarPorUsuario(codigoUsuario) : this.feedbacks.listar();
    }
}
