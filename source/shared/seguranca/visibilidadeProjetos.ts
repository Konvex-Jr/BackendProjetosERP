import { ErroAplicacao } from "../erros/ErroAplicacao";
import { ErroValidacao } from "../erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { exigirAutenticado, Permissao, temPermissao, UsuarioAutenticado } from "./permissoes";

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
    participacoes: { usuario: { codigo: string }; ativa: boolean }[];
    /** Área do projeto (interno sempre tem; de cliente, quando a gestão informou). */
    area?: { codigo: string } | null;
    /** Projeto geral (sessão 23b): quem lidera a área vê tudo, mesmo sem estar na equipe. */
    lideresDaArea?: readonly string[];
    /** Projeto geral da área: desde 25/11 todo logado vê completo. */
    geralDaArea?: boolean;
}

/** completo: vê tudo; cartao: sabe que o projeto existe (nome, tipo, área, status, líder, equipe), sem os detalhes. */
export type AcessoProjeto = "completo" | "cartao";

/**
 * Sessão 31a: todo projeto é fechado. Abre por inteiro: o projeto geral (todo logado); quem está ou esteve na
 * equipe (quem sai não perde o acesso); quem lidera a área do geral; `projetos.abrirTodos`; e `projetos.abrirDaArea`
 * quando a área do projeto é a área do período com cargo da pessoa (só a própria área, sem as subáreas).
 * Os demais veem o cartão.
 */
export function acessoAoProjeto(usuario: UsuarioAutenticado, projeto: ProjetoParaAcesso): AcessoProjeto {
    if (projeto.geralDaArea) return "completo";
    if (participaOuParticipou(usuario.codigo, projeto)) return "completo";
    if (projeto.lideresDaArea?.includes(usuario.codigo)) return "completo";
    if (temPermissao(usuario, Permissao.PROJETOS_ABRIR_TODOS)) return "completo";
    const codigoArea = projeto.area?.codigo ?? null;
    if (codigoArea && temPermissao(usuario, Permissao.PROJETOS_ABRIR_DA_AREA) && usuario.cargo?.codigoArea === codigoArea)
        return "completo";
    return "cartao";
}

/** Quem tem só o cartão recebe 403: o nome do projeto é público, então não há o que esconder com 404. */
export function exigirAcessoCompleto(usuario: UsuarioAutenticado | undefined | null, projeto: ProjetoParaAcesso): UsuarioAutenticado {
    const autenticado = exigirAutenticado(usuario);
    if (acessoAoProjeto(autenticado, projeto) === "completo") return autenticado;
    throw new ErroAplicacao(MENSAGENS_DE_ERRO.PROJETO.SEM_ACESSO, "PROJETO_SEM_ACESSO", 403);
}

/**
 * Quem cria não fica de fora (sessão 31a; antes valia só no sigiloso): o projeto novo, com a equipe inicial e a área
 * informadas, precisa abrir para quem o cria. Senão, 400 SEM_ACESSO_AO_CRIAR.
 */
export function exigirNaoSeTrancar(usuario: UsuarioAutenticado, projeto: ProjetoParaAcesso): void {
    if (acessoAoProjeto(usuario, projeto) === "completo") return;
    throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.SEM_ACESSO_AO_CRIAR, "SEM_ACESSO_AO_CRIAR");
}

/** Visões da gestão (31a): ocupação de todos, sobrecarga, passagens antigas no perfil, Alocação e Campinho. */
export function temVisoesDaGestao(usuario: UsuarioAutenticado | undefined | null): boolean {
    return temPermissao(usuario, Permissao.GESTAO_VISOES);
}
