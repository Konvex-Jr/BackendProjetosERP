import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { FiltroPessoas } from "../../domain/interfaces/UsuarioRepositoryInterface";
import Usuario from "../../domain/entity/Usuario";

/** RF-016: lista com filtros por área e status e busca por nome. */
export default class ListarUsuarios {
    private readonly repository;
    constructor(factory: RepositoryFactoryInterface) {
        this.repository = factory.criarUsuarioRepository();
    }
    async execute(filtro: FiltroPessoas = {}): Promise<Usuario[]> {
        return this.repository.listar(filtro);
    }
}
