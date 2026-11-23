import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { FUSO_KONVEX_HORAS } from "../enum/TipoCapacitacao";
import { Referencia } from "./Referencia";

/** Participante da reunião: o e-mail de login vai como convidado no Google Agenda. */
export interface ParticipanteReuniao extends Referencia {
    email: string;
}

export interface DadosReuniao {
    titulo: string;
    descricao?: string;
    data: Date;
    hora: string;
    duracaoMinutos?: number;
    local?: string;
    criadoPor: Referencia;
    participantes?: ParticipanteReuniao[];
    codigo?: string;
}

const M = MENSAGENS_DE_ERRO.REUNIAO;
export const MAXIMO_PARTICIPANTES = 100;

/**
 * Reunião da agenda (sessão 28b). Como na capacitação, a data é DATE (meia-noite UTC) e a hora
 * é a de São Paulo. Quem criou é sempre participante.
 */
export default class Reuniao {
    readonly codigo: string;
    readonly titulo: string;
    readonly descricao: string;
    readonly data: Date;
    readonly hora: string;
    readonly duracaoMinutos: number;
    readonly local: string;
    readonly criadoPor: Referencia;
    readonly participantes: ParticipanteReuniao[];

    constructor(dados: DadosReuniao) {
        this.codigo = dados.codigo ?? uuid();
        this.titulo = String(dados.titulo ?? "").trim();
        this.descricao = String(dados.descricao ?? "");
        this.data = dados.data;
        this.hora = String(dados.hora ?? "").slice(0, 5);
        this.duracaoMinutos = dados.duracaoMinutos === undefined ? 60 : Number(dados.duracaoMinutos);
        this.local = String(dados.local ?? "").trim();
        this.criadoPor = dados.criadoPor;
        this.participantes = dados.participantes ?? [];
        this.validar();
    }

    /** Instante de início (data + hora de São Paulo). */
    get inicio(): Date {
        const [h, m] = this.hora.split(":").map(Number);
        return new Date(this.data.getTime() + ((h - FUSO_KONVEX_HORAS) * 60 + m) * 60_000);
    }

    participa(codigoUsuario: string): boolean {
        return this.criadoPor.codigo === codigoUsuario || this.participantes.some((p) => p.codigo === codigoUsuario);
    }

    com(alteracoes: Partial<DadosReuniao>): Reuniao {
        return new Reuniao({ ...this.dados(), ...alteracoes });
    }

    dados(): DadosReuniao {
        return {
            codigo: this.codigo,
            titulo: this.titulo,
            descricao: this.descricao,
            data: this.data,
            hora: this.hora,
            duracaoMinutos: this.duracaoMinutos,
            local: this.local,
            criadoPor: this.criadoPor,
            participantes: this.participantes,
        };
    }

    private validar(): void {
        const erro = (mensagem: string, codigo: string) => {
            throw new ErroValidacao(mensagem, codigo);
        };
        if (!this.titulo) erro(M.TITULO_OBRIGATORIO, "TITULO_REUNIAO_OBRIGATORIO");
        if (this.titulo.length > 200) erro(M.TITULO_LONGO, "TITULO_REUNIAO_LONGO");
        if (this.descricao.length > 5_000) erro(M.DESCRICAO_LONGA, "DESCRICAO_REUNIAO_LONGA");
        if (!(this.data instanceof Date) || Number.isNaN(this.data.getTime())) erro(M.DATA_INVALIDA, "DATA_REUNIAO_INVALIDA");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(this.hora)) erro(M.HORA_INVALIDA, "HORA_REUNIAO_INVALIDA");
        if (!Number.isInteger(this.duracaoMinutos) || this.duracaoMinutos < 5 || this.duracaoMinutos > 720) {
            erro(M.DURACAO_INVALIDA, "DURACAO_REUNIAO_INVALIDA");
        }
        if (this.local.length > 300) erro(M.LOCAL_LONGO, "LOCAL_REUNIAO_LONGO");
        if (!this.criadoPor?.codigo) erro(M.SEM_CRIADOR, "REUNIAO_SEM_CRIADOR");
        if (this.participantes.length > MAXIMO_PARTICIPANTES) erro(M.MUITOS_PARTICIPANTES, "MUITOS_PARTICIPANTES");
    }
}
