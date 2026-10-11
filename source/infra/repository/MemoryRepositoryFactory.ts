import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/Interfaces/UsuarioRepositoryInterface";
import UsuarioRepositoryMemory from "./memory/UsuarioRepositoryMemory";

export default class MemoryRepositoryFactory implements RepositoryFactoryInterface {

    readonly usuarioRepository: UsuarioRepositoryInterface;

    constructor() {
        this.usuarioRepository = new UsuarioRepositoryMemory();
    }

    criarUsuarioRepository(): UsuarioRepositoryInterface {
        return this.usuarioRepository;
    }
}