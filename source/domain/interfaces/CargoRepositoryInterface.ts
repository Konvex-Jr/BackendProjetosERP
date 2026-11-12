import Cargo from "../entity/Cargo";

/** Cargos da EJ. Não há exclusão, só desativação (ADR-007), para o histórico de cargos continuar válido. */
export default interface CargoRepositoryInterface {
    listar(): Promise<Cargo[]>;
    buscarPorCodigo(codigo: string): Promise<Cargo | null>;
    criar(cargo: Cargo): Promise<Cargo>;
    editar(cargo: Cargo): Promise<Cargo>;
}
