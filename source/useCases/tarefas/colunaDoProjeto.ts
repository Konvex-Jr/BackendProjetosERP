import Projeto from "../../domain/entity/Projeto";
import ColunaProjeto from "../../domain/entity/ColunaProjeto";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

/** A coluna vem sempre das colunas de agora do projeto, nunca montada a partir do pedido. */
export function colunaDoProjeto(projeto: Projeto, codigoColuna: unknown): ColunaProjeto {
    const coluna = typeof codigoColuna === "string" ? projeto.colunas.find((c) => c.codigo === codigoColuna) : undefined;
    if (!coluna) throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.NAO_EXISTE_MAIS, "COLUNA_DE_OUTRO_PROJETO");
    return coluna;
}
