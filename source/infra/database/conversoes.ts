export function dataParaSql(data: Date): string {
    return data.toISOString().slice(0, 10);
}

export function dataParaSqlOuNulo(data: Date | null): string | null {
    return data ? dataParaSql(data) : null;
}

export function violacaoDeUnicidade(erro: unknown): boolean {
    return (
        typeof erro === "object" &&
        erro !== null &&
        (erro as { code?: string }).code === "23505"
    );
}
