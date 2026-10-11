import Documento from "../Entity/Documento";

export default interface DocumentoRepositoryInterface {
    criar(documento: Documento): Promise<Documento>;
    listarPorPasta(codigoPasta: string): Promise<Documento[]>;
    contarPorPasta(codigoPasta: string): Promise<number>;
    buscarPorCodigo(codigo: string): Promise<Documento | null>;
    editar(documento: Documento): Promise<Documento>;
    excluir(codigo: string): Promise<void>;
    excluirPorPasta(codigoPasta: string): Promise<void>;
}
