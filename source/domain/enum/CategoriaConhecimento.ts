/**
 * Categorias da Base de Inteligência (RF-081). Lugar único: o banco não repete a lista
 * e o frontend lê os rótulos de GET /conhecimento/categorias.
 */
export const CATEGORIAS_CONHECIMENTO = [
    { valor: "pesquisa", rotulo: "Pesquisa" },
    { valor: "estudo", rotulo: "Estudo" },
    { valor: "benchmark", rotulo: "Benchmark" },
    { valor: "case", rotulo: "Case" },
    { valor: "insight", rotulo: "Insight" },
    { valor: "aprendizado", rotulo: "Aprendizado" },
    { valor: "tendencia", rotulo: "Tendência" },
    { valor: "tecnologia", rotulo: "Tecnologia" },
    { valor: "ferramenta", rotulo: "Ferramenta" },
    { valor: "referencia", rotulo: "Referência" },
    { valor: "experimento", rotulo: "Resultado de experimento" },
    { valor: "decisao", rotulo: "Decisão" },
    { valor: "mercado", rotulo: "Informação de mercado" },
] as const;

export type CategoriaConhecimento = (typeof CATEGORIAS_CONHECIMENTO)[number]["valor"];

export function ehCategoriaConhecimento(valor: unknown): valor is CategoriaConhecimento {
    return CATEGORIAS_CONHECIMENTO.some((c) => c.valor === valor);
}

export const LISTA_CATEGORIAS_CONHECIMENTO = CATEGORIAS_CONHECIMENTO.map((c) => c.valor).join(", ");
