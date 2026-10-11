import Documento from "../../../domain/Entity/Documento";
import DocumentoRepositoryInterface from "../../../domain/Interfaces/DocumentoRepositoryInterface";

export default class DocumentoRepositoryMemory implements DocumentoRepositoryInterface {
    private documentos: Documento[];

    constructor() {
        this.documentos = [];
    }

    async criar(documento: Documento): Promise<Documento> {
        this.documentos.push(documento);
        return documento;
    }

    async listarPorPasta(codigoPasta: string): Promise<Documento[]> {
        return this.documentos.filter((d) => d.pasta.codigo === codigoPasta);
    }

    async contarPorPasta(codigoPasta: string): Promise<number> {
        return this.documentos.filter((d) => d.pasta.codigo === codigoPasta).length;
    }

    async buscarPorCodigo(codigo: string): Promise<Documento | null> {
        return this.documentos.find((d) => d.codigo === codigo) ?? null;
    }

    async editar(documento: Documento): Promise<Documento> {
        const indice = this.documentos.findIndex((d) => d.codigo === documento.codigo);

        if (indice === -1) {
            throw new Error("Documento não encontrado");
        }

        this.documentos[indice] = documento;
        return documento;
    }

    async excluir(codigo: string): Promise<void> {
        const indice = this.documentos.findIndex((d) => d.codigo === codigo);

        if (indice === -1) {
            throw new Error("Documento não encontrado");
        }

        this.documentos.splice(indice, 1);
    }

    async excluirPorPasta(codigoPasta: string): Promise<void> {
        this.documentos = this.documentos.filter((d) => d.pasta.codigo !== codigoPasta);
    }
}
