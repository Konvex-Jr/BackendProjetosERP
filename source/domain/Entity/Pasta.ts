import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

export default class Pasta {
    readonly codigo: string;
    readonly nome: string;

    constructor(
        nome: string,
        codigo?: string,
    ) {
        this.codigo = codigo ?? uuid();
        this.nome = nome;

        this.validar();
    }

    private validar(): void {
        if (!this.nome.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.NOME_OBRIGATORIO,
                "NOME_PASTA_OBRIGATORIO",
            );
        }

        if (this.nome.length > 120) {
            throw new ErroValidacao(
                "O nome da pasta deve ter no máximo 120 caracteres.",
                "NOME_PASTA_MUITO_LONGO",
            );
        }
    }
}
