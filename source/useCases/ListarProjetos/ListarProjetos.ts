import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/Entity/Projeto";

export default class ListarProjetos {
    private readonly projetos;
    constructor(factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
    }
    async execute(codigoUsuario?: string): Promise<Projeto[]> {
        return codigoUsuario ? this.projetos.listarPorMembro(codigoUsuario) : this.projetos.listar();
    }
}
