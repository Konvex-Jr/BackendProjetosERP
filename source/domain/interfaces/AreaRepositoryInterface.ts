import Area from "../entity/Area";

export default interface AreaRepositoryInterface {
    listar(): Promise<Area[]>;
    buscarPorCodigo(codigo: string): Promise<Area | null>;
    criar(area: Area): Promise<Area>;
    editar(area: Area): Promise<Area>;
}
