/**
 * Quem lê uma pasta e seus documentos (decisão de 03/11/2026, sessão 9).
 * - todos: qualquer pessoa ativa;
 * - gestao: só gerente e diretor (documentos.verTodas);
 * - projeto: equipe atual ou passada do projeto ligado + gestão (mesma regra de ver o projeto).
 */
enum SigiloPasta {
    TODOS = "todos",
    GESTAO = "gestao",
    PROJETO = "projeto",
}

export const SIGILOS_PASTA: SigiloPasta[] = Object.values(SigiloPasta);

export function ehSigiloPasta(valor: unknown): valor is SigiloPasta {
    return SIGILOS_PASTA.includes(valor as SigiloPasta);
}

export default SigiloPasta;
