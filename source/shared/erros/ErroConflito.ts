import { ErroAplicacao } from "./ErroAplicacao";

export class ErroConflito extends ErroAplicacao {
    constructor(
        mensagem: string,
        codigo = "ERRO_CONFLITO",
    ) {
        super(mensagem, codigo, 409);
    }
}