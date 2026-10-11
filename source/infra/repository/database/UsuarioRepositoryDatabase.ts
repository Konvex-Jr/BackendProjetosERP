import Usuario from "../../../domain/Entity/Usuario";
import User from "../../../domain/Entity/Usuario";
import UsuarioRepositoryInterface from "../../../domain/Interfaces/UsuarioRepositoryInterface";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import Connection from "../../database/Connection";

export default class UsuarioRepositoryDatabase implements UsuarioRepositoryInterface {

    constructor(protected connection: Connection) {
    }
    criar(usuario: Usuario): Promise<Usuario | null> {
        throw new Error("Method not implemented.");
    }
    listar(): Promise<Usuario[]> {
        throw new Error("Method not implemented.");
    }
    buscarPorCodigo(codigo: string): Promise<Usuario | null> {
        throw new Error("Method not implemented.");
    }
    buscarPorEmail(email: string): Promise<Usuario | null> {
        throw new Error("Method not implemented.");
    }
    editar(usuario: Usuario): Promise<Usuario> {
        throw new Error("Method not implemented.");
    }
    desativar(codigo: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
}