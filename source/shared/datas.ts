/**
 * Fuso do sistema. Data sem hora é meia-noite UTC no sistema todo (lerData, dataParaSql e o parser
 * de DATE em PgConexao); "hoje" precisa ser o dia de São Paulo, não o do relógio UTC do servidor
 * (antes, depois das 21h, gravava o dia seguinte).
 */
export const FUSO_SISTEMA = "America/Sao_Paulo";

const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_SISTEMA, year: "numeric", month: "2-digit", day: "2-digit" });

/** Dia (em São Paulo) do instante informado, como meia-noite UTC. */
export function diaNoFuso(instante: Date = new Date()): Date {
    return new Date(`${formatoDia.format(instante)}T00:00:00.000Z`);
}

/** Hoje em São Paulo, à meia-noite UTC. */
export function hoje(): Date {
    return diaNoFuso(new Date());
}
