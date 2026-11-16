import { ErroAplicacao } from "../erros/ErroAplicacao";
import { ErroNaoEncontrado } from "../erros/ErroNaoEncontrado";
import { ErroProibido } from "../erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { exigirAutenticado, Permissao, temPermissao, UsuarioAutenticado } from "./permissoes";

/**
 * Quem vê quais projetos (decisão de 30/10/2026): gerente e diretor veem todos
 * (projetos.verTodos); membro vê só os projetos de que participa ou participou.
 */
export function podeVerTodosProjetos(usuario: UsuarioAutenticado | undefined | null): boolean {
    return temPermissao(usuario, Permissao.PROJETOS_VER_TODOS);
}

/**
 * Filtro de pessoa para listar projetos. Gestor pode pedir os de qualquer pessoa (ou todos);
 * membro sempre recebe só os próprios, mesmo que peça os de outra pessoa.
 */
export function projetosVisiveisPara(usuario: UsuarioAutenticado | undefined | null, codigoUsuarioPedido?: string): string | undefined {
    const autenticado = exigirAutenticado(usuario);
    return podeVerTodosProjetos(autenticado) ? codigoUsuarioPedido : autenticado.codigo;
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
    criadoPor: string | null;
    acesso: readonly string[];
    participacoes: { usuario: { codigo: string }; ativa: boolean }[];
}

/** completo: vê tudo; resumo: gerente fora de projeto sigiloso (só andamento); nada: nem sabe que existe. */
export type AcessoProjeto = "completo" | "resumo" | "nada";

/**
 * Projeto normal: gerente/diretor veem todos; membro, se participa ou participou.
 * Sigiloso: diretor (projetos.verSigilosos), criador, lista de acesso e equipe ATUAL veem tudo;
 * o gerente fora vê o resumo; os demais, nada. Ex-equipe perde o acesso ao sigiloso.
 */
export function acessoAoProjeto(usuario: UsuarioAutenticado, projeto: ProjetoParaAcesso): AcessoProjeto {
    if (!projeto.sigiloso) {
        return podeVerTodosProjetos(usuario) || participaOuParticipou(usuario.codigo, projeto) ? "completo" : "nada";
    }
    if (temPermissao(usuario, Permissao.PROJETOS_VER_SIGILOSOS)) return "completo";
    if (projeto.criadoPor === usuario.codigo || projeto.acesso.includes(usuario.codigo)) return "completo";
    if (projeto.participacoes.some((p) => p.ativa && p.usuario.codigo === usuario.codigo)) return "completo";
    return podeVerTodosProjetos(usuario) ? "resumo" : "nada";
}

/** Quem mexe na lista de acesso e no sigilo do projeto: o diretor e quem o criou. */
export function podeGerirAcesso(usuario: UsuarioAutenticado, projeto: ProjetoParaAcesso): boolean {
    return temPermissao(usuario, Permissao.PROJETOS_VER_SIGILOSOS) || projeto.criadoPor === usuario.codigo;
}

export function exigirAcessoCompleto(usuario: UsuarioAutenticado | undefined | null, projeto: ProjetoParaAcesso): UsuarioAutenticado {
    const autenticado = exigirAutenticado(usuario);
    const acesso = acessoAoProjeto(autenticado, projeto);
    if (acesso === "completo") return autenticado;
    // Em projeto sigiloso quem não vê nada recebe 404, para não revelar que o projeto existe.
    if (projeto.sigiloso && acesso === "nada") throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);
    if (acesso === "resumo") throw new ErroAplicacao(MENSAGENS_DE_ERRO.PROJETO.SIGILOSO, "PROJETO_SIGILOSO", 403);
    throw new ErroProibido("Você só pode ver os projetos de que participa.");
}
