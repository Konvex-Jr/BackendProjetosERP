import Projeto from "../../domain/Entity/Projeto";
import Tarefa from "../../domain/Entity/Tarefa";
import { Permissao, temPermissao, UsuarioAutenticado } from "./permissoes";

/**
 * Papéis no projeto (decisão de 03/11/2026, sessão 8b):
 * - gestao (gerente/diretor) e lider: tudo nas tarefas do projeto;
 * - participante (equipe atual): cria tarefas (fica como responsável), conclui/reabre as suas, comenta;
 * - nenhum: nada.
 */
export type PapelProjeto = "gestao" | "lider" | "participante" | "nenhum";

export function papelNoProjeto(usuario: UsuarioAutenticado, projeto: Projeto | null): PapelProjeto {
    if (temPermissao(usuario, Permissao.TAREFAS_GERIR_TODAS)) return "gestao";
    if (!projeto) return "nenhum";
    if (projeto.lider?.codigo === usuario.codigo) return "lider";
    if (projeto.membros.some((m) => m.codigo === usuario.codigo)) return "participante";
    return "nenhum";
}

export function organizaTarefas(papel: PapelProjeto): boolean {
    return papel === "gestao" || papel === "lider";
}

/** Concluir/reabrir (mudar status): quem organiza, ou o participante responsável pela tarefa. */
export function podeMudarStatus(usuario: UsuarioAutenticado, papel: PapelProjeto, tarefa: Tarefa): boolean {
    if (organizaTarefas(papel)) return true;
    return papel === "participante" && tarefa.responsaveis.some((r) => r.codigo === usuario.codigo);
}
