import { ErroAplicacao } from "./ErroAplicacao";

export class ErroValidacao extends ErroAplicacao {
    constructor(
        mensagem: string,
        codigo: string = "ERRO_VALIDACAO",
    ) {
        super(mensagem, codigo, 400);
    }
}