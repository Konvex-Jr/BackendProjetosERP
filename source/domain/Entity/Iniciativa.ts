import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import {
    ehDaLista, FRENTES_INICIATIVA, FrenteIniciativa, STATUS_INICIATIVA, StatusIniciativa,
    TIPOS_INICIATIVA, TipoIniciativa, valoresDa,
} from "../Enum/Iniciativa";
import { Referencia } from "./Conhecimento";

export interface DadosIniciativa {
    titulo: string;
    tipo: string;
    frente: string;
    status?: string;
    descricao?: string;
    responsavel?: Referencia | null;
    criadoPor?: Referencia | null;
    dataInicio?: Date | null;
    dataFim?: Date | null;
    resultado?: string;
    aprendizados?: string;
    projetos?: Referencia[];
    /** Itens da Base ligados (`nome` = título do item). */
    conhecimentos?: Referencia[];
    codigo?: string;
    criadoEm?: Date;
    atualizadoEm?: Date;
}

const M = MENSAGENS_DE_ERRO.INICIATIVA;

/**
 * Iniciativa de inovação (RF-090 a RF-092). Descrição, resultado e aprendizados em Markdown simples.
 * Leitura aberta a todos; quem cria e altera está em shared/seguranca/regrasIniciativa.ts.
 */
export default class Iniciativa {
    readonly codigo: string;
    readonly titulo: string;
    readonly descricao: string;
    readonly tipo: TipoIniciativa;
    readonly frente: FrenteIniciativa;
    readonly status: StatusIniciativa;
    readonly responsavel: Referencia | null;
    readonly criadoPor: Referencia | null;
    readonly dataInicio: Date | null;
    readonly dataFim: Date | null;
    readonly resultado: string;
    readonly aprendizados: string;
    readonly projetos: Referencia[];
    readonly conhecimentos: Referencia[];
    readonly criadoEm: Date;
    readonly atualizadoEm: Date;

    constructor(dados: DadosIniciativa) {
        this.codigo = dados.codigo ?? uuid();
        this.titulo = String(dados.titulo ?? "").trim();
        this.descricao = String(dados.descricao ?? "");
        this.tipo = dados.tipo as TipoIniciativa;
        this.frente = dados.frente as FrenteIniciativa;
        this.status = (dados.status || "ideia") as StatusIniciativa;
        this.responsavel = dados.responsavel ?? null;
        this.criadoPor = dados.criadoPor ?? null;
        this.dataInicio = dados.dataInicio ?? null;
        this.dataFim = dados.dataFim ?? null;
        this.resultado = String(dados.resultado ?? "");
        this.aprendizados = String(dados.aprendizados ?? "");
        this.projetos = dados.projetos ?? [];
        this.conhecimentos = dados.conhecimentos ?? [];
        this.criadoEm = dados.criadoEm ?? new Date();
        this.atualizadoEm = dados.atualizadoEm ?? this.criadoEm;

        this.validar();
    }

    private validar(): void {
        if (!this.titulo) throw new ErroValidacao(M.TITULO_OBRIGATORIO, "TITULO_INICIATIVA_OBRIGATORIO");
        if (this.titulo.length > 160) throw new ErroValidacao(M.TITULO_LONGO, "TITULO_INICIATIVA_LONGO");
        if (!ehDaLista(TIPOS_INICIATIVA, this.tipo)) {
            throw new ErroValidacao(`Tipo inválido. Use um destes: ${valoresDa(TIPOS_INICIATIVA)}.`, "TIPO_INICIATIVA_INVALIDO");
        }
        if (!ehDaLista(FRENTES_INICIATIVA, this.frente)) {
            throw new ErroValidacao(`Frente inválida. Use uma destas: ${valoresDa(FRENTES_INICIATIVA)}.`, "FRENTE_INICIATIVA_INVALIDA");
        }
        if (!ehDaLista(STATUS_INICIATIVA, this.status)) {
            throw new ErroValidacao(`Status inválido. Use um destes: ${valoresDa(STATUS_INICIATIVA)}.`, "STATUS_INICIATIVA_INVALIDO");
        }
        if (this.descricao.length > 20000) throw new ErroValidacao(M.DESCRICAO_LONGA, "DESCRICAO_INICIATIVA_LONGA");
        if (this.resultado.length > 10000) throw new ErroValidacao(M.RESULTADO_LONGO, "RESULTADO_INICIATIVA_LONGO");
        if (this.aprendizados.length > 10000) throw new ErroValidacao(M.APRENDIZADOS_LONGOS, "APRENDIZADOS_INICIATIVA_LONGOS");
        for (const [data, campo] of [[this.dataInicio, "dataInicio"], [this.dataFim, "dataFim"]] as const) {
            if (data && Number.isNaN(data.getTime())) {
                throw new ErroValidacao(`O campo ${campo} deve ser uma data válida.`, "DATA_INVALIDA");
            }
        }
        if (this.dataInicio && this.dataFim && this.dataFim < this.dataInicio) {
            throw new ErroValidacao(M.PERIODO_INVALIDO, "PERIODO_INICIATIVA_INVALIDO");
        }
    }
}
