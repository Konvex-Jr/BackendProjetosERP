import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class ExcluirPasta {
    private readonly pastas;
    private readonly documentos;
    constructor(factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
        this.documentos = factory.criarDocumentoRepository();
    }
    async execute(codigo: string): Promise<void> {
        if (!(await this.pastas.buscarPorCodigo(codigo)))
            throw new ErroNaoEncontrado("Pasta não encontrada.");
        await this.documentos.excluirPorPasta(codigo);
        await this.pastas.excluir(codigo);
    }
}
