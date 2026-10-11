import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import Usuario from "./Usuario";

export default class Checkin {
    readonly codigo: string;
    readonly usuario: Usuario;
    readonly semana: Date;
    readonly humor: number;
    readonly resumo: string;
    readonly aprendizados: string;
    readonly sentimento: string | null;

    constructor(
        usuario: Usuario,
        semana: Date,
        resumo: string,
        aprendizados: string,
        humor: number = 3,
        sentimento: string | null = null,
        codigo?: string,
    ) {
        this.codigo = codigo ?? uuid();
        this.usuario = usuario;
        this.semana = semana;
        this.resumo = resumo;
        this.aprendizados = aprendizados;
        this.humor = humor;
        this.sentimento = sentimento;

        this.validar();
    }

    private validar(): void {
        if (Number.isNaN(this.semana.getTime())) {
            throw new ErroValidacao(
                "A semana do check-in deve ser uma data válida.",
                "SEMANA_CHECKIN_INVALIDA",
            );
        }

        // Datas ISO (YYYY-MM-DD) são interpretadas em UTC, por isso getUTCDay.
        if (this.semana.getUTCDay() !== 1) {
            throw new ErroValidacao(
                "A semana do check-in deve ser representada pela segunda-feira.",
                "SEMANA_CHECKIN_NAO_E_SEGUNDA",
            );
        }

        if (!Number.isInteger(this.humor) || this.humor < 1 || this.humor > 5) {
            throw new ErroValidacao(
                "O humor deve ser um número inteiro entre 1 e 5.",
                "HUMOR_CHECKIN_INVALIDO",
            );
        }

        if (!this.resumo.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "RESUMO_CHECKIN_OBRIGATORIO",
            );
        }

        if (!this.aprendizados.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "APRENDIZADOS_CHECKIN_OBRIGATORIO",
            );
        }
    }
}
