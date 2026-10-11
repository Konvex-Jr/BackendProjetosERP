import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Documento from "../../domain/Entity/Documento";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class ListarDocumentos {
    private readonly pastas;
    private readonly documentos;
    constructor(factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
        this.documentos = factory.criarDocumentoRepository();
    }
    async execute(codigoPasta: string): Promise<Documento[]> {
        if (!(await this.pastas.buscarPorCodigo(codigoPasta)))
            throw new ErroNaoEncontrado("Pasta não encontrada.");
        return this.documentos.listarPorPasta(codigoPasta);
    }
}
