import Capacitacao from "../Entity/Capacitacao";

export default interface CapacitacaoRepositoryInterface {
    criar(capacitacao: Capacitacao): Promise<Capacitacao>;
    listar(): Promise<Capacitacao[]>;
    buscarPorCodigo(codigo: string): Promise<Capacitacao | null>;
    editar(capacitacao: Capacitacao): Promise<Capacitacao>;
}
