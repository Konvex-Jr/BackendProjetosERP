import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { DonoAnexo } from "../../domain/Enum/Anexo";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import GerirAnexos from "../GerirAnexos/GerirAnexos";

export default class ExcluirDocumento {
    private readonly documentos;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.documentos = factory.criarDocumentoRepository();
    }
    /** Documento do tipo arquivo leva junto o arquivo (sessão 12c). */
    async execute(codigo: string): Promise<void> {
        if (!(await this.documentos.buscarPorCodigo(codigo))) throw new ErroNaoEncontrado("Documento não encontrado.");
        await new GerirAnexos(this.factory).excluirDosDonos(DonoAnexo.DOCUMENTO, [codigo]);
        await this.documentos.excluir(codigo);
    }
}
