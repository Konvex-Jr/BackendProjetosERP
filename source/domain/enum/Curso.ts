/** Cursos aceitos no cadastro da pessoa (sessão 25b). Dado antigo fora da lista continua carregando. */
export const CURSOS: readonly string[] = ["Ciência da Computação", "Engenharia Mecânica", "Engenharia Elétrica"];

export function ehCursoValido(valor: string): boolean {
    return CURSOS.includes(valor);
}
