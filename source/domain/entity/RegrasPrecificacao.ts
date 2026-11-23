import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

/**
 * Regras da simulação de precificação (sessão 29), configuradas pela diretoria.
 * Percentuais são acréscimos sobre o valor (negativo = redução, só no tipo de cliente).
 * O cálculo fica no frontend (`src/lib/precificacao.js`); aqui só se guardam e validam as regras.
 */
export interface RegrasPrecificacao {
    complexidade: { baixa: number; media: number; alta: number };
    risco: { escopo: number; tecnologia: number; terceiros: number };
    urgencia: number;
    tipoCliente: { parceira: number; pequena: number; mediaGrande: number };
    contingencia: number;
    suporteHorasMes: number;
    impostos: number;
    margem: number;
    margemMinima: number;
    descontoMaximo: number;
    validadeDias: number;
}

export const REGRAS_PADRAO: RegrasPrecificacao = {
    complexidade: { baixa: 0, media: 15, alta: 30 },
    risco: { escopo: 10, tecnologia: 10, terceiros: 5 },
    urgencia: 20,
    tipoCliente: { parceira: -20, pequena: 0, mediaGrande: 20 },
    contingencia: 10,
    suporteHorasMes: 4,
    impostos: 10,
    margem: 30,
    margemMinima: 15,
    descontoMaximo: 15,
    validadeDias: 15,
};

type Limite = [minimo: number, maximo: number, inteiro?: boolean];

/** Faixa aceita de cada campo (caminho com ponto para os agrupados). */
const LIMITES: Record<string, Limite> = {
    "complexidade.baixa": [0, 100],
    "complexidade.media": [0, 100],
    "complexidade.alta": [0, 100],
    "risco.escopo": [0, 100],
    "risco.tecnologia": [0, 100],
    "risco.terceiros": [0, 100],
    urgencia: [0, 100],
    "tipoCliente.parceira": [-50, 100],
    "tipoCliente.pequena": [-50, 100],
    "tipoCliente.mediaGrande": [-50, 100],
    contingencia: [0, 50],
    suporteHorasMes: [0, 80],
    impostos: [0, 60],
    margem: [0, 200],
    margemMinima: [0, 200],
    descontoMaximo: [0, 50],
    validadeDias: [1, 180, true],
};

const ler = (obj: unknown, caminho: string): unknown =>
    caminho
        .split(".")
        .reduce<unknown>(
            (atual, chave) => (atual && typeof atual === "object" ? (atual as Record<string, unknown>)[chave] : undefined),
            obj,
        );

/** Valida todas as regras (todos os campos obrigatórios) e arredonda para uma casa decimal. */
export function validarRegrasPrecificacao(bruto: unknown): RegrasPrecificacao {
    const regras = structuredClone(REGRAS_PADRAO) as unknown as Record<string, Record<string, number> | number>;
    for (const [caminho, [minimo, maximo, inteiro]] of Object.entries(LIMITES)) {
        const valor = ler(bruto, caminho);
        if (
            typeof valor !== "number" ||
            !Number.isFinite(valor) ||
            valor < minimo ||
            valor > maximo ||
            (inteiro && !Number.isInteger(valor))
        ) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.PRECIFICACAO.REGRA_INVALIDA(caminho, minimo, maximo, !!inteiro),
                "REGRA_PRECIFICACAO_INVALIDA",
            );
        }
        const arredondado = Math.round(valor * 10) / 10;
        const [grupo, campo] = caminho.split(".");
        if (campo) (regras[grupo] as Record<string, number>)[campo] = arredondado;
        else regras[grupo] = arredondado;
    }
    const final = regras as unknown as RegrasPrecificacao;
    if (final.margemMinima > final.margem) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.PRECIFICACAO.MARGEM_MINIMA_ACIMA, "REGRA_PRECIFICACAO_INVALIDA");
    }
    return final;
}

/** Junta o que está gravado com o padrão (campo novo ou estragado volta ao padrão). */
export function regrasComPadrao(gravadas: unknown): RegrasPrecificacao {
    const regras = structuredClone(REGRAS_PADRAO) as unknown as Record<string, Record<string, number> | number>;
    for (const caminho of Object.keys(LIMITES)) {
        const valor = ler(gravadas, caminho);
        if (typeof valor !== "number" || !Number.isFinite(valor)) continue;
        const [grupo, campo] = caminho.split(".");
        if (campo) (regras[grupo] as Record<string, number>)[campo] = valor;
        else regras[grupo] = valor;
    }
    return regras as unknown as RegrasPrecificacao;
}
