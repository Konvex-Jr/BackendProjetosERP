/**
 * Data (dia, sem hora) para "AAAA-MM-DD", o formato de uma coluna DATE. Usa o dia em UTC porque,
 * no sistema todo, data sem hora é meia-noite UTC: lerData na entrada e o parser de DATE em
 * PgConexao na saída. Assim o dia gravado não depende do fuso do servidor.
 * Atenção: com um instante (`new Date()`), grava o dia em UTC; depois das 21h em São Paulo,
 * isso já é o dia seguinte.
 */
export function dataParaSql(data: Date): string {
    return data.toISOString().slice(0, 10);
}

export function dataParaSqlOuNulo(data: Date | null): string | null {
    return data ? dataParaSql(data) : null;
}

/** 23505 é o código de "unique_violation" no PostgreSQL; os repositórios o traduzem em ErroConflito (409). */
export function violacaoDeUnicidade(erro: unknown): boolean {
    return typeof erro === "object" && erro !== null && (erro as { code?: string }).code === "23505";
}
