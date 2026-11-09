import Capacitacao from "../Entity/Capacitacao";
import { Referencia } from "../Entity/Conhecimento";

export default interface CapacitacaoRepositoryInterface {
    /** Ordenadas por data e hora. */
    listar(): Promise<Capacitacao[]>;
    buscarPorCodigo(codigo: string): Promise<Capacitacao | null>;
    criar(capacitacao: Capacitacao): Promise<Capacitacao>;
    /** Grava os dados da capacitação (não mexe nas inscrições). */
    editar(capacitacao: Capacitacao): Promise<Capacitacao>;
    excluir(codigo: string): Promise<void>;
    /** Inscreve se ainda houver vaga; devolve false se lotou. */
    inscrever(codigo: string, usuario: Referencia): Promise<boolean>;
    cancelarInscricao(codigo: string, codigoUsuario: string): Promise<void>;
    /** Marca presentes os informados e ausentes os demais inscritos. */
    marcarPresencas(codigo: string, presentes: string[]): Promise<void>;
}
