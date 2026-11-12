import { ErroAplicacao } from "./ErroAplicacao";

/** Sem login, login inválido ou sessão expirada (HTTP 401). Para "logado, mas sem permissão", use ErroProibido. */
export class ErroNaoAutorizado extends ErroAplicacao {
    constructor(mensagem = "Acesso não autorizado") {
        super(mensagem, "ACESSO_NAO_AUTORIZADO", 401);
    }
}
