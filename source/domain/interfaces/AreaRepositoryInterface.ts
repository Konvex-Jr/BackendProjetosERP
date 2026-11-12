import Area from "../entity/Area";

/** Áreas da EJ, em árvore (área pai). Não há exclusão: área que deixa de ser usada é desativada, como os cargos (ADR-007). */
export default interface AreaRepositoryInterface {
    listar(): Promise<Area[]>;
    buscarPorCodigo(codigo: string): Promise<Area | null>;
    criar(area: Area): Promise<Area>;
    editar(area: Area): Promise<Area>;
}
