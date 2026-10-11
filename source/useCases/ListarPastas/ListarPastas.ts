import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Pasta from "../../domain/Entity/Pasta";

export default class ListarPastas {
    private readonly pastas;
    constructor(factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
    }
    async execute(): Promise<Pasta[]> {
        return this.pastas.listar();
    }
}
