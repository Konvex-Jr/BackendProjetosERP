import { ErroAplicacao } from "./ErroAplicacao";

export class ErroNaoAutorizado extends ErroAplicacao {
    constructor(mensagem = "Acesso não autorizado") {
        super(mensagem, "ACESSO_NAO_AUTORIZADO", 401);
    }
}