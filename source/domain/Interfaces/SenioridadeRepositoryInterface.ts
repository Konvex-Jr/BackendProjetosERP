import SenioridadeUsuario from "../Entity/SenioridadeUsuario";

export default interface SenioridadeRepositoryInterface {
    listar(): Promise<SenioridadeUsuario[]>;
    buscarPorCodigo(codigo: string): Promise<SenioridadeUsuario | null>;
}
