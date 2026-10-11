import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Pasta from "../../domain/Entity/Pasta";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class RenomearPasta {
    private readonly pastas;
    constructor(factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
    }
    async execute(codigo: string, nome: string): Promise<Pasta> {
        const p = await this.pastas.buscarPorCodigo(codigo);
        if (!p)
            throw new ErroNaoEncontrado("Pasta não encontrada.");
        return this.pastas.editar(new Pasta(nome.trim(), p.codigo));
    }
}
