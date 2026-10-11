import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Documento from "../../domain/Entity/Documento";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class RenomearDocumento {
    private readonly documentos;
    constructor(factory: RepositoryFactoryInterface) {
        this.documentos = factory.criarDocumentoRepository();
    }
    async execute(codigo: string, nome: string): Promise<Documento> {
        const d = await this.documentos.buscarPorCodigo(codigo);
        if (!d)
            throw new ErroNaoEncontrado("Documento não encontrado.");
        return this.documentos.editar(new Documento(d.pasta, nome.trim(), d.tamanhoBytes, d.dataEnvio, d.autor, d.arquivoUrl, d.extensao, d.codigo));
    }
}
