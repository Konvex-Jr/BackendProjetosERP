import { ErroAplicacao } from "./ErroAplicacao";

export class ErroNaoEncontrado extends ErroAplicacao {
    constructor(mensagem = "Recurso não encontrado") {
        super(mensagem, "RECURSO_NAO_ENCONTRADO", 404);
    }
}