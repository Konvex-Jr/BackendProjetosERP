/**
 * Quem lê um item da Biblioteca (sessão 17):
 * - todos: qualquer pessoa ativa;
 * - gestao: só gerente e diretor (biblioteca.verTodos);
 * - projeto: equipe atual ou passada do projeto ligado + gestão;
 * - diretoria: só quem tem clientes.ver (contratos e dados de cliente; sessão 31b).
 */
enum SigiloBiblioteca {
    TODOS = "todos",
    GESTAO = "gestao",
    PROJETO = "projeto",
    DIRETORIA = "diretoria",
}

export const SIGILOS_BIBLIOTECA: SigiloBiblioteca[] = Object.values(SigiloBiblioteca);

export function ehSigiloBiblioteca(valor: unknown): valor is SigiloBiblioteca {
    return SIGILOS_BIBLIOTECA.includes(valor as SigiloBiblioteca);
}

export default SigiloBiblioteca;
