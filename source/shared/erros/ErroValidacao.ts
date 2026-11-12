import { ErroAplicacao } from "./ErroAplicacao";

/** Entrada inválida (HTTP 400). A mensagem deve dizer qual campo está errado e como corrigir. */
export class ErroValidacao extends ErroAplicacao {
    constructor(mensagem: string, codigo: string = "ERRO_VALIDACAO") {
        super(mensagem, codigo, 400);
    }
}
