export type TipoLink = "convite" | "redefinir";

export interface RegistroLinkSenha {
    codigo: string;
    codigoUsuario: string;
    tipo: TipoLink;
    tokenHash: string;
    expiraEm: Date;
    usadoEm: Date | null;
}

/** Guarda só o hash do token do link, nunca o token em si. */
export default interface LinkSenhaRepositoryInterface {
    criar(registro: RegistroLinkSenha): Promise<void>;
    buscarPorHash(tokenHash: string): Promise<RegistroLinkSenha | null>;
    /** Marca como usados os links ainda abertos da pessoa (de um tipo, ou de todos). */
    invalidarDoUsuario(codigoUsuario: string, tipo?: TipoLink): Promise<void>;
    /** `true` só para quem marcou: garante uso único mesmo com dois cliques ao mesmo tempo. */
    marcarUsado(codigo: string): Promise<boolean>;
}
