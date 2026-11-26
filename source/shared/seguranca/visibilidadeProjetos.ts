import { ErroAplicacao } from "../erros/ErroAplicacao";
import { ErroValidacao } from "../erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { exigirAutenticado, Permissao, temPermissao, UsuarioAutenticado } from "./permissoes";

/**
 * Gerente e diretor (projetos.verTodos) veem completos todos os projetos normais (decisão de 30/10/2026);
 * os demais, só os de que participam ou participaram. Os outros chegam como cartão (sessão 27a).
 */
export function podeVerTodosProjetos(usuario: UsuarioAutenticado | undefined | null): boolean {
    // Provisório (31a, Task 3): a regra pela área do cargo entra na Task 5.
    return temPermissao(usuario, Permissao.PROJETOS_ABRIR_TODOS) || temPermissao(usuario, Permissao.GESTAO_VISOES);
}

/** Só o que a regra precisa (tipo estrutural), para não depender da entidade Projeto inteira. */
interface ProjetoComEquipe {
    participacoes: { usuario: { codigo: string } }[];
}

/** Olha todas as participações, inclusive as encerradas: quem saiu do projeto continua vendo o histórico. */
export function participaOuParticipou(codigoUsuario: string, projeto: ProjetoComEquipe): boolean {
    return projeto.participacoes.some((p) => p.usuario.codigo === codigoUsuario);
}

/** Só o que a regra de acesso precisa do projeto (tipo estrutural). */
export interface ProjetoParaAcesso {
    sigiloso: boolean;
    participacoes: { usuario: { codigo: string }; ativa: boolean }[];
    /** Projeto geral (sessão 23b): quem lidera a área vê tudo, mesmo sem estar na equipe. */
    lideresDaArea?: readonly string[];
    /** Projeto geral da área: desde 25/11 todo logado vê completo (o geral nunca é sigiloso). */
    geralDaArea?: boolean;
}

/** completo: vê tudo; cartao: sabe que o projeto existe (nome, tipo, área, status, líder), sem os detalhes. */
export type AcessoProjeto = "completo" | "cartao";

/**
 * Sessão 27a: todo logado vê o cartão de todos os projetos; o completo é de quem trabalha neles e da gestão.
 * Normal: gerente/diretor (projetos.verTodos), equipe atual ou antiga e, no projeto geral, quem lidera a área.
 * Sigiloso: diretor (projetos.verSigilosos) e equipe ATUAL. Ex-equipe e quem só criou o projeto ficam no cartão.
 * Projeto geral da área (25/11): todo logado vê completo; criar e mover tarefas continua com a área e a liderança.
 */
export function acessoAoProjeto(usuario: UsuarioAutenticado, projeto: ProjetoParaAcesso): AcessoProjeto {
    if (projeto.geralDaArea && !projeto.sigiloso) return "completo";
    if (!projeto.sigiloso) {
        const lideraArea = projeto.lideresDaArea?.includes(usuario.codigo) ?? false;
        return podeVerTodosProjetos(usuario) || lideraArea || participaOuParticipou(usuario.codigo, projeto) ? "completo" : "cartao";
    }
    if (temPermissao(usuario, Permissao.PROJETOS_ABRIR_TODOS)) return "completo";
    return projeto.participacoes.some((p) => p.ativa && p.usuario.codigo === usuario.codigo) ? "completo" : "cartao";
}

/** Quem tem só o cartão recebe 403: o nome do projeto é público, então não há o que esconder com 404. */
export function exigirAcessoCompleto(usuario: UsuarioAutenticado | undefined | null, projeto: ProjetoParaAcesso): UsuarioAutenticado {
    const autenticado = exigirAutenticado(usuario);
    if (acessoAoProjeto(autenticado, projeto) === "completo") return autenticado;
    throw new ErroAplicacao(MENSAGENS_DE_ERRO.PROJETO.SEM_ACESSO(projeto.sigiloso), "PROJETO_SEM_ACESSO", 403);
}

/**
 * Ninguém se tranca fora de um sigiloso (sessão 27a): quem liga o sigilo precisa ser diretor ou estar na
 * equipe atual (na criação, a equipe inicial). Senão, 400 SIGILOSO_SEM_VOCE.
 */
export function exigirNaoSeTrancar(usuario: UsuarioAutenticado, codigosEquipeAtual: readonly string[]): void {
    if (temPermissao(usuario, Permissao.PROJETOS_ABRIR_TODOS)) return;
    if (codigosEquipeAtual.includes(usuario.codigo)) return;
    throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.SIGILOSO_SEM_VOCE, "SIGILOSO_SEM_VOCE");
}
