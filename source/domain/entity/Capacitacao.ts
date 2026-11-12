import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import TipoCapacitacao, { FUSO_KONVEX_HORAS } from "../enum/TipoCapacitacao";
import { Referencia } from "./Conhecimento";

/** Inscrição numa capacitação. `presente` nulo = a gestão ainda não marcou. */
export interface Inscricao {
    usuario: Referencia;
    presente: boolean | null;
}

export interface DadosCapacitacao {
    titulo: string;
    descricao?: string;
    data: Date;
    hora: string;
    duracaoHoras?: number;
    instrutor: Referencia;
    vagas: number;
    tipo: string;
    sala: string;
    inscricoes?: Inscricao[];
    codigo?: string;
}

const M = MENSAGENS_DE_ERRO.CAPACITACAO;

/**
 * Capacitação interna (RF-070 a RF-073; regras da sessão 13, 09/11/2026). A data é DATE
 * (meia-noite UTC) e a hora é a de São Paulo; `inicio` junta as duas num instante.
 */
export default class Capacitacao {
    readonly codigo: string;
    readonly titulo: string;
    readonly descricao: string;
    readonly data: Date;
    readonly hora: string;
    readonly duracaoHoras: number;
    readonly instrutor: Referencia;
    readonly vagas: number;
    readonly tipo: TipoCapacitacao;
    readonly sala: string;
    readonly inscricoes: Inscricao[];

    constructor(dados: DadosCapacitacao) {
        this.codigo = dados.codigo ?? uuid();
        this.titulo = String(dados.titulo ?? "").trim();
        this.descricao = String(dados.descricao ?? "");
        this.data = dados.data;
        this.hora = String(dados.hora ?? "").slice(0, 5);
        this.duracaoHoras = dados.duracaoHoras === undefined ? 1 : Number(dados.duracaoHoras);
        this.instrutor = dados.instrutor;
        this.vagas = Number(dados.vagas);
        this.tipo = dados.tipo as TipoCapacitacao;
        this.sala = String(dados.sala ?? "").trim();
        this.inscricoes = dados.inscricoes ?? [];
        this.validar();
    }

    /** Instante de início (data + hora de São Paulo). */
    get inicio(): Date {
        const [h, m] = this.hora.split(":").map(Number);
        return new Date(this.data.getTime() + ((h - FUSO_KONVEX_HORAS) * 60 + m) * 60_000);
    }

    jaComecou(agora: Date = new Date()): boolean {
        return this.inicio.getTime() <= agora.getTime();
    }

    get vagasRestantes(): number {
        return Math.max(0, this.vagas - this.inscricoes.length);
    }

    inscricaoDe(codigoUsuario: string): Inscricao | null {
        return this.inscricoes.find((i) => i.usuario.codigo === codigoUsuario) ?? null;
    }

    com(alteracoes: Partial<DadosCapacitacao>): Capacitacao {
        return new Capacitacao({ ...this.dados(), ...alteracoes });
    }

    dados(): DadosCapacitacao {
        return {
            codigo: this.codigo,
            titulo: this.titulo,
            descricao: this.descricao,
            data: this.data,
            hora: this.hora,
            duracaoHoras: this.duracaoHoras,
            instrutor: this.instrutor,
            vagas: this.vagas,
            tipo: this.tipo,
            sala: this.sala,
            inscricoes: this.inscricoes,
        };
    }

    private validar(): void {
        const erro = (mensagem: string, codigo: string) => {
            throw new ErroValidacao(mensagem, codigo);
        };
        if (!this.titulo) erro(M.TITULO_OBRIGATORIO, "TITULO_CAPACITACAO_OBRIGATORIO");
        if (this.titulo.length > 200) erro(M.TITULO_LONGO, "TITULO_CAPACITACAO_LONGO");
        if (this.descricao.length > 10_000) erro(M.DESCRICAO_LONGA, "DESCRICAO_CAPACITACAO_LONGA");
        if (!(this.data instanceof Date) || Number.isNaN(this.data.getTime())) erro(M.DATA_INVALIDA, "DATA_CAPACITACAO_INVALIDA");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(this.hora)) erro(M.HORA_INVALIDA, "HORA_CAPACITACAO_INVALIDA");
        if (
            !Number.isFinite(this.duracaoHoras) ||
            this.duracaoHoras < 0.5 ||
            this.duracaoHoras > 24 ||
            Math.round(this.duracaoHoras * 10) !== this.duracaoHoras * 10
        ) {
            erro(M.DURACAO_INVALIDA, "DURACAO_CAPACITACAO_INVALIDA");
        }
        if (!Number.isInteger(this.vagas) || this.vagas < 1 || this.vagas > 500) erro(M.VAGAS_INVALIDAS, "VAGAS_INVALIDAS");
        if (!Object.values(TipoCapacitacao).includes(this.tipo)) erro(M.TIPO_INVALIDO, "TIPO_CAPACITACAO_INVALIDO");
        if (!this.sala) erro(M.SALA_OBRIGATORIA, "SALA_CAPACITACAO_OBRIGATORIA");
        if (this.sala.length > 60) erro(M.SALA_LONGA, "SALA_CAPACITACAO_LONGA");
        if (!this.instrutor?.codigo) erro(M.INSTRUTOR_OBRIGATORIO, "INSTRUTOR_OBRIGATORIO");
        if (this.inscricoes.length > this.vagas) erro(M.VAGAS_MENOR_QUE_INSCRITOS, "VAGAS_MENOR_QUE_INSCRITOS");
    }
}
