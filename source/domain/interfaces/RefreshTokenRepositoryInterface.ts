export interface RegistroRefreshToken {
    codigo: string;
    codigoUsuario: string;
    tokenHash: string;
    expiraEm: Date;
    revogadoEm: Date | null;
    /** "Manter conectado": o refresh vale 15 dias contados do login. */
    lembrar: boolean;
    /** Revogado por rotação (já foi trocado por outro). Só reapresentar um girado indica vazamento. */
    girado: boolean;
}

/** Guarda só o hash do refresh token, nunca o token em si. */
export default interface RefreshTokenRepositoryInterface {
    criar(registro: RegistroRefreshToken): Promise<void>;
    buscarPorHash(tokenHash: string): Promise<RegistroRefreshToken | null>;
    /** Marca como revogado; devolve false se já estava revogado (outra chamada chegou antes). */
    revogar(codigo: string): Promise<boolean>;
    /** Revoga na rotação e marca como girado; devolve false se já estava revogado. */
    girar(codigo: string): Promise<boolean>;
    revogarTodosDoUsuario(codigoUsuario: string): Promise<void>;
}
