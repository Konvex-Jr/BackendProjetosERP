/**
 * Categorias de tarefa avulsa (sem projeto), decididas em 03/11/2026 (sessão 8c).
 * Lista fixa num só lugar; se mudar muito, vira cadastro em Configurações.
 */
enum CategoriaTarefa {
    INOVACAO = "inovacao",
    CAPACITACAO = "capacitacao",
    EXECUCAO = "execucao",
}

export const CATEGORIAS_TAREFA: CategoriaTarefa[] = Object.values(CategoriaTarefa);

export function ehCategoriaTarefa(valor: unknown): valor is CategoriaTarefa {
    return CATEGORIAS_TAREFA.includes(valor as CategoriaTarefa);
}

export default CategoriaTarefa;
