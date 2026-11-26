import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

/** Classe do projeto (sessão 31b): landing page, CRM, SaaS... Lista editável em Configurações. */
export default class ClasseProjeto {
    constructor(
        readonly codigo: string,
        readonly nome: string,
        readonly ordem: number = 0,
    ) {
        if (!nome || !nome.trim() || nome.trim().length > 80) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.CLASSE.NOME_INVALIDO, "CLASSE_NOME_INVALIDO");
        }
    }

    toJSON() {
        return { codigo: this.codigo, nome: this.nome, ordem: this.ordem };
    }
}
