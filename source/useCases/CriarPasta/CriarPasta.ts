import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Pasta from "../../domain/Entity/Pasta";

export default class CriarPasta {
    private readonly pastas;
    constructor(factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
    }
    async execute(nome: string): Promise<Pasta> {
        return this.pastas.criar(new Pasta(nome.trim()));
    }
}
