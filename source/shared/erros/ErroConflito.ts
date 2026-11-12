import { ErroAplicacao } from "./ErroAplicacao";

/** Pedido válido que esbarra no estado atual (e-mail já cadastrado, capacitação lotada...): HTTP 409. */
export class ErroConflito extends ErroAplicacao {
    constructor(mensagem: string, codigo = "ERRO_CONFLITO") {
        super(mensagem, codigo, 409);
    }
}
