import Capacitacao from "../../domain/entity/Capacitacao";
import { Permissao } from "./catalogoPermissoes";
import { temPermissao, UsuarioAutenticado } from "./permissoes";

/**
 * Capacitações (decisões de 09/11/2026, sessão 13):
 * - ler a lista e a ficha: qualquer pessoa logada (média e número de avaliações incluídos);
 * - criar, editar, excluir, marcar presença, anexar material, inscrever ou tirar outra pessoa: só a gestão;
 * - inscrever-se e cancelar: a própria pessoa, até a hora de início (a gestão, a qualquer momento);
 * - avaliar: só quem a gestão marcou como presente, depois do início;
 * - avaliações individuais: a gestão vê com o nome; quem ministrou vê sem o nome; os demais não veem.
 */
export function podeGerirCapacitacoes(usuario: UsuarioAutenticado | null | undefined): boolean {
    return Boolean(usuario) && temPermissao(usuario!, Permissao.CAPACITACOES_GERIR);
}

export function ehInstrutor(usuario: UsuarioAutenticado | null | undefined, c: Capacitacao): boolean {
    return Boolean(usuario) && c.instrutor.codigo === usuario!.codigo;
}

/** "com-nome" para a gestão, "sem-nome" para quem ministrou, null para os demais. */
export function acessoAosFeedbacks(usuario: UsuarioAutenticado | null | undefined, c: Capacitacao): "com-nome" | "sem-nome" | null {
    if (podeGerirCapacitacoes(usuario)) return "com-nome";
    if (ehInstrutor(usuario, c)) return "sem-nome";
    return null;
}
