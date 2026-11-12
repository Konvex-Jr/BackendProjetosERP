/** Corpo de POST /auth/login. O e-mail é comparado sem diferenciar maiúsculas. */
export default interface LoginUsuarioInput {
    email: string;
    senha: string;
}
