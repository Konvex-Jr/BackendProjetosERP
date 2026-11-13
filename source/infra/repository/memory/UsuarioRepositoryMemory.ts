import Usuario from "../../../domain/entity/Usuario";
import UsuarioRepositoryInterface, { FiltroPessoas } from "../../../domain/interfaces/UsuarioRepositoryInterface";
import StatusPessoa from "../../../domain/enum/StatusPessoa";
import { normalizarBusca } from "../../../shared/texto";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { ErroConflito } from "../../../shared/erros/ErroConflito";

export default class UsuarioRepositoryMemory implements UsuarioRepositoryInterface {
    private usuarios: Usuario[];

    constructor() {
        this.usuarios = [];
    }

    async criar(usuario: Usuario): Promise<Usuario | null> {
        const codigoEmUso = this.usuarios.some((u) => u.codigo === usuario.codigo);
        const emailEmUso = this.usuarios.some((u) => u.email.toLowerCase() === usuario.email.toLowerCase());

        if (codigoEmUso || emailEmUso) {
            return null;
        }

        this.usuarios.push(usuario);
        return usuario;
    }

    async listar(filtro: FiltroPessoas = {}): Promise<Usuario[]> {
        const busca = normalizarBusca(filtro.busca);
        return this.usuarios
            .filter((u) => !filtro.status?.length || filtro.status.includes(u.status))
            .filter((u) => !filtro.codigoArea || u.area?.codigo === filtro.codigoArea)
            .filter((u) => !busca || normalizarBusca(`${u.nome} ${u.nomeExibicao ?? ""} ${u.email}`).includes(busca))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }

    async buscarPorCodigo(codigo: string): Promise<Usuario | null> {
        return this.usuarios.find((u) => u.codigo === codigo) ?? null;
    }

    async buscarPorEmail(email: string): Promise<Usuario | null> {
        const emailNormalizado = email.trim().toLowerCase();
        return this.usuarios.find((u) => u.email.toLowerCase() === emailNormalizado) ?? null;
    }

    async editar(usuario: Usuario): Promise<Usuario> {
        const indice = this.usuarios.findIndex((u) => u.codigo === usuario.codigo);

        if (indice === -1) {
            throw new ErroNaoEncontrado("Usuário não encontrado.");
        }

        const emailEmUsoPorOutro = this.usuarios.some(
            (u) => u.codigo !== usuario.codigo && u.email.toLowerCase() === usuario.email.toLowerCase(),
        );

        if (emailEmUsoPorOutro) {
            throw new ErroConflito("Este e-mail já está cadastrado.", "EMAIL_JA_CADASTRADO");
        }

        this.usuarios[indice] = usuario;
        return usuario;
    }

    async desativar(codigo: string): Promise<void> {
        const indice = this.usuarios.findIndex((u) => u.codigo === codigo);

        if (indice === -1) {
            throw new ErroNaoEncontrado("Usuário não encontrado.");
        }

        this.usuarios[indice] = this.usuarios[indice].copiar({ status: StatusPessoa.INATIVO });
    }
}
