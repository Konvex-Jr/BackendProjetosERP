import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Pasta from "../../domain/Entity/Pasta";
import { UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { filtrarPastasVisiveis } from "../../shared/seguranca/sigiloPastas";

export default class ListarPastas {
    private readonly pastas;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
    }
    /** Com `usuario`, devolve só as pastas que ele pode ler (sigilo). */
    async execute(usuario?: UsuarioAutenticado): Promise<Pasta[]> {
        const todas = await this.pastas.listar();
        return usuario ? filtrarPastasVisiveis(usuario, todas, this.factory) : todas;
    }
}
