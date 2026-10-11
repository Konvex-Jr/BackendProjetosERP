import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class InativarUsuario {
    private readonly usuarios;
    constructor(factory: RepositoryFactoryInterface) {
        this.usuarios = factory.criarUsuarioRepository();
    }
    async execute(codigo: string): Promise<void> {
        if (!(await this.usuarios.buscarPorCodigo(codigo)))
            throw new ErroNaoEncontrado("Usuário não encontrado.");
        await this.usuarios.desativar(codigo);
    }
}
