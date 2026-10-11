import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Capacitacao from "../../domain/Entity/Capacitacao";

export default class ListarCapacitacoes {
    private readonly capacitacoes;
    constructor(factory: RepositoryFactoryInterface) {
        this.capacitacoes = factory.criarCapacitacaoRepository();
    }
    async execute(): Promise<Capacitacao[]> {
        return this.capacitacoes.listar();
    }
}
