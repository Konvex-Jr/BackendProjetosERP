import Usuario from "../entity/Usuario";
import StatusPessoa from "../enum/StatusPessoa";

/** Filtros da lista de pessoas (RF-016). */
export interface FiltroPessoas {
    status?: StatusPessoa[];
    codigoArea?: string;
    busca?: string;
}

/** Pessoas da EJ (com ou sem acesso ao sistema). */
export default interface UsuarioRepositoryInterface {
    criar(usuario: Usuario): Promise<Usuario | null>;
    listar(filtro?: FiltroPessoas): Promise<Usuario[]>;
    buscarPorCodigo(codigo: string): Promise<Usuario | null>;
    buscarPorEmail(email: string): Promise<Usuario | null>;
    /** Grava todos os campos da pessoa, inclusive habilidades. */
    editar(usuario: Usuario): Promise<Usuario>;
    /** Muda o status para Inativo. Pessoas nunca são excluídas (ADR-006). */
    desativar(codigo: string): Promise<void>;
}
