import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/Interfaces/UsuarioRepositoryInterface";
import Connection from "../database/Connection";
import UsuarioRepositoryDatabase from "./database/UsuarioRepositoryDatabase";

export default class DatabaseRepositoryFactory implements RepositoryFactoryInterface {

    readonly usuarioRepository: UsuarioRepositoryInterface;

    constructor(connection: Connection) {
        this.usuarioRepository = new UsuarioRepositoryDatabase(connection);
    }

    criarUsuarioRepository(): UsuarioRepositoryInterface {
        return this.usuarioRepository;
    }
}