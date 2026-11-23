/** Cursos aceitos no cadastro da pessoa (sessão 25b; ADS em 23/11). Dado antigo fora da lista continua carregando. */
export const CURSOS: readonly string[] = [
    "Análise e Desenvolvimento de Sistemas",
    "Ciência da Computação",
    "Engenharia Elétrica",
    "Engenharia Mecânica",
];

export function ehCursoValido(valor: string): boolean {
    return CURSOS.includes(valor);
}
