/** Corpo de POST /auth/login. O e-mail é comparado sem diferenciar maiúsculas. */
export default interface LoginUsuarioInput {
    email: string;
    senha: string;
    /** "Manter conectado": grava o cookie de lembrete (15 dias). */
    manterConectado?: boolean;
}
