import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { DonoAnexo } from "../../domain/Enum/Anexo";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import GerirAnexos from "../GerirAnexos/GerirAnexos";

export default class ExcluirPasta {
    private readonly pastas;
    private readonly documentos;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
        this.documentos = factory.criarDocumentoRepository();
    }
    /** Apaga também os arquivos dos documentos da pasta (sessão 12c). */
    async execute(codigo: string): Promise<void> {
        if (!(await this.pastas.buscarPorCodigo(codigo)))
            throw new ErroNaoEncontrado("Pasta não encontrada.");
        const documentos = await this.documentos.listarPorPasta(codigo);
        await new GerirAnexos(this.factory).excluirDosDonos(DonoAnexo.DOCUMENTO, documentos.map((d) => d.codigo));
        await this.documentos.excluirPorPasta(codigo);
        await this.pastas.excluir(codigo);
    }
}
