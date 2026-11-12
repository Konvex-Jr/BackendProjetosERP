import Pasta from "../entity/Pasta";

/** Pastas de documentos. Não aplica o sigilo: quem filtra é shared/seguranca/sigiloPastas.ts. */
export default interface PastaRepositoryInterface {
    criar(pasta: Pasta): Promise<Pasta>;
    listar(): Promise<Pasta[]>;
    buscarPorCodigo(codigo: string): Promise<Pasta | null>;
    editar(pasta: Pasta): Promise<Pasta>;
    excluir(codigo: string): Promise<void>;
}
