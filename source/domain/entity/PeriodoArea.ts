import { v4 as uuid } from "uuid";
import Area from "./Area";
import Cargo from "./Cargo";
import StatusPessoa, { STATUS_NA_EJ } from "../enum/StatusPessoa";
import { hoje } from "../../shared/datas";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

const M = MENSAGENS_DE_ERRO.PERIODO;

type Intervalo = { inicio: Date; fim: Date | null };

/**
 * Passagem de uma pessoa por uma área, com cargo opcional (spec 23, seção 5).
 * Intervalo semiaberto [inicio, fim): fim nulo = em aberto; um período termina no dia em que o próximo começa.
 */
export default class PeriodoArea {
    readonly codigo: string;
    readonly codigoUsuario: string;
    readonly area: Area;
    readonly cargo: Cargo | null;
    readonly inicio: Date;
    readonly fim: Date | null;
    readonly codigoRegistradoPor: string | null;

    constructor(
        codigoUsuario: string,
        area: Area,
        cargo: Cargo | null,
        inicio: Date,
        fim: Date | null,
        codigoRegistradoPor: string | null,
        codigo?: string,
    ) {
        this.codigo = codigo ?? uuid();
        this.codigoUsuario = codigoUsuario;
        this.area = area;
        this.cargo = cargo;
        this.inicio = inicio;
        this.fim = fim;
        this.codigoRegistradoPor = codigoRegistradoPor;
        this.validar();
    }

    /**
     * Monta o período lido do banco sem as regras de data: elas valem ao gravar, não ao ler.
     * Um fim gravado por encerrarAbertosDe pode ficar no dia seguinte a hoje (início + 1 dia),
     * e a leitura não pode falhar por isso.
     */
    static carregar(
        codigoUsuario: string,
        area: Area,
        cargo: Cargo | null,
        inicio: Date,
        fim: Date | null,
        codigoRegistradoPor: string | null,
        codigo: string,
    ): PeriodoArea {
        return Object.assign(Object.create(PeriodoArea.prototype) as PeriodoArea, {
            codigo,
            codigoUsuario,
            area,
            cargo,
            inicio,
            fim,
            codigoRegistradoPor,
        });
    }

    get aberto(): boolean {
        return this.fim === null;
    }

    copiar(parcial: { area?: Area; cargo?: Cargo | null; inicio?: Date; fim?: Date | null }): PeriodoArea {
        return new PeriodoArea(
            this.codigoUsuario,
            parcial.area ?? this.area,
            parcial.cargo !== undefined ? parcial.cargo : this.cargo,
            parcial.inicio ?? this.inicio,
            parcial.fim !== undefined ? parcial.fim : this.fim,
            this.codigoRegistradoPor,
            this.codigo,
        );
    }

    private validar(): void {
        const agora = hoje().getTime();
        if (this.inicio.getTime() > agora) throw new ErroValidacao(M.INICIO_NO_FUTURO, "INICIO_NO_FUTURO");
        if (this.fim && this.fim.getTime() > agora) throw new ErroValidacao(M.FIM_NO_FUTURO, "FIM_NO_FUTURO");
        if (this.fim && this.fim.getTime() <= this.inicio.getTime()) {
            throw new ErroValidacao(M.FIM_NAO_DEPOIS_DO_INICIO, "FIM_NAO_DEPOIS_DO_INICIO");
        }
    }
}

/** Dois intervalos semiabertos se sobrepõem? Fim nulo = infinito. */
export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
    const aComecaAntesDoFimDeB = b.fim === null || a.inicio.getTime() < b.fim.getTime();
    const bComecaAntesDoFimDeA = a.fim === null || b.inicio.getTime() < a.fim.getTime();
    return aComecaAntesDoFimDeB && bComecaAntesDoFimDeA;
}

const formatar = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

/** Erro de período sobreposto, citando as datas do conflito (sem ele, a mensagem genérica). */
export function erroSobreposicao(conflito: Intervalo | null): ErroValidacao {
    const mensagem = conflito
        ? M.SOBREPOSTO(formatar(conflito.inicio), conflito.fim ? formatar(conflito.fim) : null)
        : M.SOBREPOSTO_SEM_DATAS;
    return new ErroValidacao(mensagem, "PERIODO_SOBREPOSTO");
}

/**
 * Regras que dependem de outros períodos e da pessoa. `anterior` é a versão gravada do período
 * em edição (null se novo): área/cargo inativos só barram quando mudam.
 */
export function validarNovoPeriodo(
    periodo: PeriodoArea,
    outros: PeriodoArea[],
    anterior: PeriodoArea | null,
    pessoa: { status: StatusPessoa; dataSaida: Date | null },
): void {
    const conflito = outros.find((o) => o.codigo !== periodo.codigo && o.area.codigo === periodo.area.codigo && sobrepoe(o, periodo));
    if (conflito) throw erroSobreposicao(conflito);
    if (!periodo.area.ativa && periodo.area.codigo !== anterior?.area.codigo) throw new ErroValidacao(M.AREA_INATIVA, "AREA_INATIVA");
    if (periodo.cargo && !periodo.cargo.ativo && periodo.cargo.codigo !== anterior?.cargo?.codigo) {
        throw new ErroValidacao(M.CARGO_INATIVO, "CARGO_INATIVO");
    }
    if (periodo.aberto && !STATUS_NA_EJ.includes(pessoa.status)) throw new ErroValidacao(M.PESSOA_FORA_DA_EJ, "PESSOA_FORA_DA_EJ");
    if (periodo.fim && pessoa.dataSaida && periodo.fim.getTime() > pessoa.dataSaida.getTime()) {
        throw new ErroValidacao(M.FIM_DEPOIS_DA_SAIDA, "FIM_DEPOIS_DA_SAIDA");
    }
}
