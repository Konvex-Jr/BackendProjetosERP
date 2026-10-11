import Usuario from "../Entity/Usuario";

export default interface UsuarioRepositoryInterface {
    criar(usuario: Usuario): Promise<Usuario | null>;
    listar(): Promise<Usuario[]>;
    buscarPorCodigo(codigo: string): Promise<Usuario | null>;
    buscarPorEmail(email: string): Promise<Usuario | null>;
    editar(usuario: Usuario): Promise<Usuario>;
    desativar(codigo: string): Promise<void>;
}