import SenioridadeUsuario from "../entity/SenioridadeUsuario";

/** Senioridades (níveis da pessoa na EJ), cadastradas em Configurações. */
export default interface SenioridadeRepositoryInterface {
    /** Em ordem crescente de senioridade. */
    listar(): Promise<SenioridadeUsuario[]>;
    buscarPorCodigo(codigo: string): Promise<SenioridadeUsuario | null>;
    criar(senioridade: SenioridadeUsuario): Promise<SenioridadeUsuario>;
    /** Altera nome e ordem. O valor-hora é tratado na fase 3 (precificação). */
    editar(senioridade: SenioridadeUsuario): Promise<SenioridadeUsuario>;
}
