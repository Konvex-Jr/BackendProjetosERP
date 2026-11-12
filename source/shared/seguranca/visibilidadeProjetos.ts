import { ErroProibido } from "../erros/ErroProibido";
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

export function exigirVerProjeto(usuario: UsuarioAutenticado | undefined | null, projeto: ProjetoComEquipe): void {
    const autenticado = exigirAutenticado(usuario);
    if (podeVerTodosProjetos(autenticado) || participaOuParticipou(autenticado.codigo, projeto)) return;
    throw new ErroProibido("Você só pode ver os projetos de que participa.");
}
