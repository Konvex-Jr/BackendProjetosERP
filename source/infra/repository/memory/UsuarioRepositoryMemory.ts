import Usuario from "../../../domain/Entity/Usuario";
import UsuarioRepositoryInterface from "../../../domain/Interfaces/UsuarioRepositoryInterface";

export default class UsuarioRepositoryMemory implements UsuarioRepositoryInterface {
    private usuarios: Usuario[];

    constructor() {
        this.usuarios = [];
    }

    async criar(usuario: Usuario): Promise<Usuario | null> {
        const codigoEmUso = this.usuarios.some((u) => u.codigo === usuario.codigo);
        const emailEmUso = this.usuarios.some(
            (u) => u.email.toLowerCase() === usuario.email.toLowerCase(),
        );

        if (codigoEmUso || emailEmUso) {
            return null;
        }

        this.usuarios.push(usuario);
        return usuario;
    }

    async listar(): Promise<Usuario[]> {
        return [...this.usuarios];
    }

    async buscarPorCodigo(codigo: string): Promise<Usuario | null> {
        return this.usuarios.find((u) => u.codigo === codigo) ?? null;
    }

    async buscarPorEmail(email: string): Promise<Usuario | null> {
        const emailNormalizado = email.trim().toLowerCase();
        return (
            this.usuarios.find((u) => u.email.toLowerCase() === emailNormalizado) ??
            null
        );
    }

    async editar(usuario: Usuario): Promise<Usuario> {
        const indice = this.usuarios.findIndex((u) => u.codigo === usuario.codigo);

        if (indice === -1) {
            throw new Error("Usuário não encontrado");
        }

        const emailEmUsoPorOutro = this.usuarios.some(
            (u) =>
                u.codigo !== usuario.codigo &&
                u.email.toLowerCase() === usuario.email.toLowerCase(),
        );

        if (emailEmUsoPorOutro) {
            throw new Error("E-mail já cadastrado");
        }

        this.usuarios[indice] = usuario;
        return usuario;
    }

    async desativar(codigo: string): Promise<void> {
        const indice = this.usuarios.findIndex((u) => u.codigo === codigo);

        if (indice === -1) {
            throw new Error("Usuário não encontrado");
        }

        const atual = this.usuarios[indice];
        this.usuarios[indice] = new Usuario(
            atual.nome,
            atual.email,
            atual.perfil,
            false,
            atual.senha,
            atual.senioridade,
            atual.codigo,
        );
    }
}