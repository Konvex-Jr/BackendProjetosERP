import { ErroValidacao } from "../../shared/erros/ErroValidacao";

export default class SenioridadeUsuario {
    readonly codigo: string;
    readonly nome: string;
    readonly valorHora: number;
    /** Posição na escada de senioridade (Trainee = 1 ... Liderança = 5). */
    readonly ordem: number;

    constructor(
        codigo: string,
        nome: string,
        valorHora: number,
        ordem: number = 0,
    ) {
        this.codigo = codigo;
        this.nome = nome;
        this.valorHora = valorHora;
        this.ordem = ordem;

        this.validar();
    }

    private validar(): void {
        if (!this.codigo.trim()) {
            throw new ErroValidacao(
                "O código da senioridade é obrigatório.",
                "CODIGO_SENIORIDADE_OBRIGATORIO",
            );
        }

        if (!this.nome.trim()) {
            throw new ErroValidacao(
                "O nome da senioridade é obrigatório.",
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