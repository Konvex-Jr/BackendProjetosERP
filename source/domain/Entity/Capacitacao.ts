import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import Usuario from "./Usuario";
import TipoCapacitacao from "../Enum/TipoCapacitacao";

export default class Capacitacao {
    readonly codigo: string;
    readonly titulo: string;
    readonly data: Date;
    readonly hora: string;
    readonly instrutor: Usuario;
    readonly vagas: number;
    readonly tipo: TipoCapacitacao;
    readonly sala: string;
    readonly inscritos: Usuario[];

    constructor(
        titulo: string,
        data: Date,
        hora: string,
        instrutor: Usuario,
        vagas: number,
        tipo: TipoCapacitacao,
        sala: string,
        inscritos: Usuario[] = [],
        codigo?: string,
    ) {
        this.codigo = codigo ?? uuid();
        this.titulo = titulo;
        this.data = data;
        this.hora = hora;
        this.instrutor = instrutor;
        this.vagas = vagas;
        this.tipo = tipo;
        this.sala = sala;
        this.inscritos = inscritos;

        this.validar();
    }

    foiRealizada(hoje: Date): boolean {
        const dataCapacitacao = new Date(this.data);
        const [horas, minutos] = this.hora.split(":").map(Number);
        dataCapacitacao.setHours(horas, minutos, 0, 0);
        return dataCapacitacao.getTime() <= hoje.getTime();
    }

    temVaga(): boolean {
        return this.inscritos.length < this.vagas;
    }

    estaInscrito(usuario: Usuario): boolean {
        return this.inscritos.some((inscrito) => inscrito.codigo === usuario.codigo);
    }

    private validar(): void {
        if (!this.titulo.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "TITULO_CAPACITACAO_OBRIGATORIO",
            );
        }

        if (Number.isNaN(this.data.getTime())) {
            throw new ErroValidacao(
                "A data da capacitação deve ser válida.",
                "DATA_CAPACITACAO_INVALIDA",
            );
        }

        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(this.hora)) {
            throw new ErroValidacao(
                "A hora deve estar no formato HH:mm.",
                "HORA_CAPACITACAO_INVALIDA",
            );
        }

        if (!this.sala.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "SALA_CAPACITACAO_OBRIGATORIA",
            );
        }

        if (!Number.isInteger(this.vagas) || this.vagas <= 0) {
            throw new ErroValidacao(
                "O número de vagas deve ser um inteiro maior que zero.",
                "VAGAS_INVALIDAS",
            );
        }

        const codigosInscritos = this.inscritos.map((inscrito) => inscrito.codigo);
        if (new Set(codigosInscritos).size !== codigosInscritos.length) {
            throw new ErroValidacao(
                "Há inscritos duplicados na capacitação.",
                "INSCRITO_DUPLICADO",
            );
        }

        if (this.inscritos.length > this.vagas) {
            throw new ErroValidacao(
                "O número de inscritos excede as vagas disponíveis.",
                "VAGAS_ESGOTADAS",
            );
        }
    }
}
