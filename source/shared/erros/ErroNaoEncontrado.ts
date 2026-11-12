import { ErroAplicacao } from "./ErroAplicacao";

/** HTTP 404. Também usado quando a pessoa não pode ver o item, para não revelar que ele existe. */
export class ErroNaoEncontrado extends ErroAplicacao {
    constructor(mensagem = "Recurso não encontrado") {
        super(mensagem, "RECURSO_NAO_ENCONTRADO", 404);
    }
}
