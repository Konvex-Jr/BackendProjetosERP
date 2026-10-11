import Pasta from "../Entity/Pasta";

export default interface PastaRepositoryInterface {
    criar(pasta: Pasta): Promise<Pasta>;
    listar(): Promise<Pasta[]>;
    buscarPorCodigo(codigo: string): Promise<Pasta | null>;
    editar(pasta: Pasta): Promise<Pasta>;
    excluir(codigo: string): Promise<void>;
}
