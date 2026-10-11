import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

export default class SenioridadeUsuario {
    readonly codigo: string;
    readonly nome: string;
    readonly valorHora: number;

    constructor(
        codigo: string,
        nome: string,
        valorHora: number,
    ) {
        this.codigo = codigo;
        this.nome = nome;
        this.valorHora = valorHora;

        this.validar();
    }

    private validar(): void {
        if (!this.codigo.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "CODIGO_SENIORIDADE_OBRIGATORIO",
            );
        }

        if (!this.nome.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "NOME_SENIORIDADE_OBRIGATORIO",
            );
        }

        if (!Number.isFinite(this.valorHora) || this.valorHora < 0) {
            throw new ErroValidacao(
                "O valor-hora deve ser um número válido e não negativo.",
                "VALOR_HORA_INVALIDO",
            );
        }
    }
}