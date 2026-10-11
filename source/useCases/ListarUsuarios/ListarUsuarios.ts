import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Usuario from "../../domain/Entity/Usuario";

export default class ListarUsuarios {
    private readonly repository;
    constructor(factory: RepositoryFactoryInterface) {
        this.repository = factory.criarUsuarioRepository();
    }
    async execute(): Promise<Usuario[]> {
        return this.repository.listar();
    }
}
