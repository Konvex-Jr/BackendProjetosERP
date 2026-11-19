import Projeto from "../../domain/entity/Projeto";
import Tarefa from "../../domain/entity/Tarefa";
import { Permissao, temPermissao, UsuarioAutenticado } from "./permissoes";
import { acessoAoProjeto } from "./visibilidadeProjetos";

/**
 * Política única de tarefas (sessões 8b, 20 e 23b). Tudo o que decide quem pode o quê numa tarefa fica aqui.
 *
 * Tarefa de projeto (8b), pelo papel no projeto:
 * - gestao (tarefas.gerirTodas) e lider: tudo;
 * - participante (equipe atual): cria (fica como responsável), conclui/reabre as suas, comenta; se criou a tarefa,
 *   também a edita e exclui (`editar`, sessão 24b), sem trocar responsáveis nem situação (isso é de `organizar` e `mudarStatus`);
 * - nenhum: só vê se for responsável ou tiver participado do projeto.
 *
 * Projeto sigiloso (sessão 20): quem não tem acesso completo ao projeto (`acessoAoProjeto`) não vê nem faz
 * nada nas tarefas dele, nem sendo responsável ou gerente. Quem tem acesso completo sempre vê. A gestão com
 * acesso completo (diretor, gerente da lista de acesso ou que criou) organiza como em qualquer projeto; quem não
 * é da gestão e está fora da equipe atual (membro da lista de acesso) só lê: não comenta nem muda status.
 *
 * Projeto geral da área (sessão 23b): a equipe vem dos períodos na área (aberto = equipe atual, encerrado = ex-equipe)
 * e quem tem cargo que lidera a área (`lideresDaArea`) conta como líder: organiza tudo, mas não entra como
 * responsável, porque não está na equipe. Toda tarefa tem projeto: a tarefa avulsa (8c) acabou.
 */
export type PapelProjeto = "gestao" | "lider" | "participante" | "nenhum";

export interface RegrasTarefa {
    ver: boolean;
    organizar: boolean;
    /** Edita e exclui: quem organiza, ou o participante da equipe atual que criou a tarefa (24b). */
    editar: boolean;
    mudarStatus: boolean;
    comentar: boolean;
}

/**
 * Papel mais forte da pessoa no projeto. A gestão vem primeiro: um gerente que também lidera
 * o projeto conta como "gestao". `membros` só tem a equipe atual, então quem saiu vira "nenhum".
 */
export function papelNoProjeto(usuario: UsuarioAutenticado, projeto: Projeto | null): PapelProjeto {
    // Em sigiloso, sem acesso completo ninguém tem papel (a gestão fora também não).
    if (projeto?.sigiloso && acessoAoProjeto(usuario, projeto) !== "completo") return "nenhum";
    if (temPermissao(usuario, Permissao.TAREFAS_GERIR_TODAS)) return "gestao";
    if (!projeto) return "nenhum";
    if (projeto.ehLider(usuario.codigo)) return "lider";
    if (projeto.membros.some((m) => m.codigo === usuario.codigo)) return "participante";
    return "nenhum";
}

/**
 * Regras do usuário numa tarefa. `projeto` é o projeto atual (com equipe e líder) da tarefa;
 * nulo só se o projeto sumiu (aí ninguém além do responsável e da gestão vê).
 */
export function regrasTarefa(usuario: UsuarioAutenticado, tarefa: Tarefa, projeto: Projeto | null): RegrasTarefa {
    const responsavel = tarefa.responsaveis.some((r) => r.codigo === usuario.codigo);

    if (projeto?.sigiloso && acessoAoProjeto(usuario, projeto) !== "completo") {
        return { ver: false, organizar: false, editar: false, mudarStatus: false, comentar: false };
    }
    const papel = papelNoProjeto(usuario, projeto);
    const organizar = papel === "gestao" || papel === "lider";
    // Gestão, quem participa ou participou e quem lidera a área do geral. Sigiloso: chegar aqui já é ter acesso completo.
    const verProjeto =
        temPermissao(usuario, Permissao.PROJETOS_VER_TODOS) || (projeto !== null && acessoAoProjeto(usuario, projeto) === "completo");
    return {
        ver: organizar || responsavel || verProjeto,
        organizar,
        editar: organizar || (papel === "participante" && tarefa.criadaPor?.codigo === usuario.codigo),
        mudarStatus: organizar || (papel === "participante" && responsavel),
        // Comentar exige estar na equipe atual: quem só participou no passado continua lendo, mas não comenta.
        comentar: papel !== "nenhum",
    };
}
