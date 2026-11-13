import { ErroAplicacao } from "./ErroAplicacao";

/** Tentativas demais num intervalo curto, como senhas erradas seguidas no login (HTTP 429). */
export class ErroMuitasTentativas extends ErroAplicacao {
    constructor(mensagem: string) {
        super(mensagem, "MUITAS_TENTATIVAS", 429);
    }
}
