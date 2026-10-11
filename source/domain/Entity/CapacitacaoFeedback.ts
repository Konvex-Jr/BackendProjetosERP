import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import Capacitacao from "./Capacitacao";
import Usuario from "./Usuario";

export default class CapacitacaoFeedback {
    readonly codigo: string;
    readonly capacitacao: Capacitacao;
    readonly usuario: Usuario;
    readonly nota: number;
    readonly data: Date;
    readonly bom: string | null;
    readonly melhorar: string | null;

    constructor(
        capacitacao: Capacitacao,
        usuario: Usuario,
        nota: number,
        data: Date,
        bom: string | null = null,
        melhorar: string | null = null,
        codigo?: string,
    ) {
        this.codigo = codigo ?? uuid();
        this.capacitacao = capacitacao;
        this.usuario = usuario;
        this.nota = nota;
        this.data = data;
        this.bom = bom;
        this.melhorar = melhorar;

        this.validar();
    }

    private validar(): void {
        if (!Number.isInteger(this.nota) || this.nota < 1 || this.nota > 5) {
            throw new ErroValidacao(
                "A nota deve ser um número inteiro entre 1 e 5.",
                "NOTA_FEEDBACK_INVALIDA",
            );
        }

        if (Number.isNaN(this.data.getTime())) {
            throw new ErroValidacao(
                "A data do feedback deve ser válida.",
                "DATA_FEEDBACK_INVALIDA",
            );
        }

        if (!this.capacitacao.estaInscrito(this.usuario)) {
            throw new ErroValidacao(
                "Somente inscritos podem avaliar a capacitação.",
                "FEEDBACK_USUARIO_NAO_INSCRITO",
            );
        }

        if (!this.capacitacao.foiRealizada(this.data)) {
            throw new ErroValidacao(
                "A capacitação só pode ser avaliada depois de realizada.",
                "FEEDBACK_CAPACITACAO_NAO_REALIZADA",
            );
        }
    }
}
