import Projeto from "../../domain/entity/Projeto";
import Tarefa from "../../domain/entity/Tarefa";
import { Permissao, temPermissao, UsuarioAutenticado } from "./permissoes";
import { participaOuParticipou } from "./visibilidadeProjetos";

/**
 * Política única de tarefas (sessões 8b e 8c). Tudo o que decide quem pode o quê numa tarefa fica aqui.
 *
 * Tarefa de projeto (8b), pelo papel no projeto:
 * - gestao (tarefas.gerirTodas) e lider: tudo;
 * - participante (equipe atual): cria (fica como responsável), conclui/reabre as suas, comenta;
 * - nenhum: só vê se for responsável ou tiver participado do projeto.
 *
 * Tarefa avulsa (8c, sem projeto, com categoria):
 * - gestão (tarefas.atribuir): cria, edita, exclui, reatribui, conclui e comenta; vê todas;
 * - responsável: vê, conclui/reabre e comenta;
 * - os demais: não veem.
 */
export type PapelProjeto = "gestao" | "lider" | "participante" | "nenhum";

export interface RegrasTarefa {
    ver: boolean;
    organizar: boolean;
    mudarStatus: boolean;
    comentar: boolean;
}

/**
 * Papel mais forte da pessoa no projeto. A gestão vem primeiro: um gerente que também lidera
 * o projeto conta como "gestao". `membros` só tem a equipe atual, então quem saiu vira "nenhum".
 */
export function papelNoProjeto(usuario: UsuarioAutenticado, projeto: Projeto | null): PapelProjeto {
    if (temPermissao(usuario, Permissao.TAREFAS_GERIR_TODAS)) return "gestao";
    if (!projeto) return "nenhum";
    if (projeto.lider?.codigo === usuario.codigo) return "lider";
    if (projeto.membros.some((m) => m.codigo === usuario.codigo)) return "participante";
    return "nenhum";
}

export function podeAtribuirAvulsas(usuario: UsuarioAutenticado): boolean {
    return temPermissao(usuario, Permissao.TAREFAS_ATRIBUIR);
}

/**
 * Regras do usuário numa tarefa. `projeto` é o projeto atual (com equipe e líder) da tarefa,
 * ou nulo se a tarefa for avulsa.
 */
export function regrasTarefa(usuario: UsuarioAutenticado, tarefa: Tarefa, projeto: Projeto | null): RegrasTarefa {
    const responsavel = tarefa.responsaveis.some((r) => r.codigo === usuario.codigo);

    if (tarefa.avulsa) {
        const gestao = podeAtribuirAvulsas(usuario);
        return { ver: gestao || responsavel, organizar: gestao, mudarStatus: gestao || responsavel, comentar: gestao || responsavel };
    }

    const papel = papelNoProjeto(usuario, projeto);
    const organizar = papel === "gestao" || papel === "lider";
    const verProjeto =
        temPermissao(usuario, Permissao.PROJETOS_VER_TODOS) || (projeto !== null && participaOuParticipou(usuario.codigo, projeto));
    return {
        ver: organizar || responsavel || verProjeto,
        organizar,
        mudarStatus: organizar || (papel === "participante" && responsavel),
        // Comentar exige estar na equipe atual: quem só participou no passado continua lendo, mas não comenta.
        comentar: papel !== "nenhum",
    };
}
