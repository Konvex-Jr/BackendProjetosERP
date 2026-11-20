import { Lembrete, Sessao } from "./emitirSessao";

/**
 * Resposta do login: a mesma sessão emitida no refresh e, com "Manter conectado", o lembrete.
 * A rota tira o lembrete do corpo e o manda só no cookie HttpOnly.
 */
type LoginUsuarioOutput = Sessao & { lembrete?: Lembrete };
export default LoginUsuarioOutput;
