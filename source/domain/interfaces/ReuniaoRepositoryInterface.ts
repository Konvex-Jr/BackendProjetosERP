import Reuniao from "../entity/Reuniao";

/** Reuniões da agenda (sessão 28b); os participantes vêm junto na entidade. */
export default interface ReuniaoRepositoryInterface {
    /** Reuniões de que a pessoa participa (ou criou) com data entre `de` e `ate` (inclusive), por data e hora. */
    listarDaPessoa(codigoUsuario: string, de: Date, ate: Date): Promise<Reuniao[]>;
    buscarPorCodigo(codigo: string): Promise<Reuniao | null>;
    /** Grava a reunião e troca a lista de participantes. */
    criar(reuniao: Reuniao): Promise<Reuniao>;
    editar(reuniao: Reuniao): Promise<Reuniao>;
    excluir(codigo: string): Promise<void>;
}
