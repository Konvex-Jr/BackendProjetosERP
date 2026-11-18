import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { FiltroPessoas } from "../../domain/interfaces/UsuarioRepositoryInterface";
import Usuario from "../../domain/entity/Usuario";
import { preencherAreasAtuais } from "./areasAtuais";

export interface FiltroListaPessoas extends FiltroPessoas {
    /** Só quem tem esta área entre as atuais (períodos em aberto). */
    codigoArea?: string;
}

/** RF-016: lista com filtros por área atual e status e busca por nome. */
export default class ListarUsuarios {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(filtro: FiltroListaPessoas = {}): Promise<Usuario[]> {
        const { codigoArea, ...doBanco } = filtro;
        const usuarios = await preencherAreasAtuais(this.factory, await this.factory.criarUsuarioRepository().listar(doBanco));
        return codigoArea ? usuarios.filter((u) => u.areas.some((a) => a.area.codigo === codigoArea)) : usuarios;
    }
}
