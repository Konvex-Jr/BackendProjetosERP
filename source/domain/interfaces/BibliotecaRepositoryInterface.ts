import ItemBiblioteca from "../entity/ItemBiblioteca";
import SigiloBiblioteca from "../enum/SigiloBiblioteca";

export interface FiltrosBiblioteca {
    busca?: string;
    tag?: string;
    codigoProjeto?: string;
    sigilo?: SigiloBiblioteca;
    codigoAutor?: string;
}

export default interface BibliotecaRepositoryInterface {
    criar(item: ItemBiblioteca): Promise<ItemBiblioteca>;
    /** Mais recentes primeiro (atualizado_em desc). Não filtra por visibilidade. */
    listar(filtros?: FiltrosBiblioteca): Promise<ItemBiblioteca[]>;
    buscarPorCodigo(codigo: string): Promise<ItemBiblioteca | null>;
    editar(item: ItemBiblioteca): Promise<ItemBiblioteca>;
    excluir(codigo: string): Promise<void>;
    /** Tira o projeto dos itens que não são de sigilo projeto (exclusão de projeto). */
    desligarProjeto(codigoProjeto: string): Promise<void>;
}
