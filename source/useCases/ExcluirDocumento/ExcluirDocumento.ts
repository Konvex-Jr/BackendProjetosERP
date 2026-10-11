import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class ExcluirDocumento {
    private readonly documentos;
    constructor(factory: RepositoryFactoryInterface) {
        this.documentos = factory.criarDocumentoRepository();
    }
    async execute(codigo: string): Promise<void> {
        if (!(await this.documentos.buscarPorCodigo(codigo)))
            throw new ErroNaoEncontrado("Documento não encontrado.");
        await this.documentos.excluir(codigo);
    }
}
