import ItemBiblioteca from "../../domain/entity/ItemBiblioteca";
import SigiloBiblioteca from "../../domain/enum/SigiloBiblioteca";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../erros/ErroNaoEncontrado";
import { ErroProibido } from "../erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { Permissao } from "./catalogoPermissoes";
import { exigirAutenticado, temPermissao, UsuarioAutenticado } from "./permissoes";
import { acessoAoProjeto } from "./visibilidadeProjetos";

/** Projetos que a pessoa abre por inteiro (sessão 31a: equipe, cargo ou geral; `acessoAoProjeto`). */
export interface ContextoProjetos {
    completos: Set<string>;
}

/**
 * Quem lê e altera itens da Biblioteca (sessão 17; 31a). "todos": todos; "gestao": biblioteca.verTodos;
 * "projeto": quem abre o projeto (`acessoAoProjeto`), para todos os papéis.
 * Item invisível se comporta como inexistente (404). Alterar: autor ou biblioteca.gerir.
 */
export function podeVerTodosItens(usuario: UsuarioAutenticado | undefined | null): boolean {
    return temPermissao(usuario, Permissao.BIBLIOTECA_VER_TODOS);
}

export function podeVerItem(usuario: UsuarioAutenticado, item: ItemBiblioteca, ctx: ContextoProjetos): boolean {
    // "Todos" vale pelo sigilo do item, mesmo ligado a projeto que a pessoa não abre (o projeto chega nulo).
    if (item.sigilo === SigiloBiblioteca.TODOS) return true;
    // "Equipe do projeto" exige abrir o projeto, para todos (31a: nem biblioteca.verTodos passa por cima do projeto fechado).
    if (item.sigilo === SigiloBiblioteca.PROJETO) return !!item.projeto && ctx.completos.has(item.projeto.codigo);
    if (podeVerTodosItens(usuario)) return true;
    // Sigilo "gestao" (ou valor desconhecido): só quem passou na primeira checagem.
    return false;
}

export function podeAlterarItem(usuario: UsuarioAutenticado | null | undefined, item: ItemBiblioteca): boolean {
    if (!usuario) return false;
    return item.autor?.codigo === usuario.codigo || temPermissao(usuario, Permissao.BIBLIOTECA_GERIR);
}

/** Projetos que a pessoa abre por inteiro (sessão 31a: todo projeto é fechado a quem não é da equipe nem tem o cargo). */
export async function contextoProjetos(usuario: UsuarioAutenticado, factory: RepositoryFactoryInterface): Promise<ContextoProjetos> {
    const projetos = await factory.criarProjetoRepository().listar();
    return { completos: new Set(projetos.filter((p) => acessoAoProjeto(usuario, p) === "completo").map((p) => p.codigo)) };
}

/** Se a pessoa pode ver o projeto ligado a um item: só se abre o projeto; senão o item mostra projeto nulo. */
export function podeVerProjetoDoItem(_usuario: UsuarioAutenticado, codigoProjeto: string, ctx: ContextoProjetos): boolean {
    return ctx.completos.has(codigoProjeto);
}

export async function exigirVerItem(
    usuario: UsuarioAutenticado | undefined | null,
    item: ItemBiblioteca | null,
    factory: RepositoryFactoryInterface,
): Promise<ItemBiblioteca> {
    const autenticado = exigirAutenticado(usuario);
    if (item && podeVerItem(autenticado, item, await contextoProjetos(autenticado, factory))) return item;
    // 404, e não 403: quem não pode ler o item não deve nem saber que ele existe.
    throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.BIBLIOTECA.NAO_ENCONTRADO);
}

export function exigirAlterarItem(usuario: UsuarioAutenticado | null | undefined, item: ItemBiblioteca): UsuarioAutenticado {
    const autenticado = exigirAutenticado(usuario);
    if (!podeAlterarItem(autenticado, item)) throw new ErroProibido(MENSAGENS_DE_ERRO.BIBLIOTECA.SEM_PERMISSAO);
    return autenticado;
}

/**
 * Impede o membro de escalar privilégio ao criar ou editar: sigilo "gestao" só com biblioteca.gerir;
 * ligar a um projeto exige abri-lo (sessão 31a).
 */
export async function exigirPodeUsarSigiloEProjeto(
    usuario: UsuarioAutenticado | null | undefined,
    sigilo: SigiloBiblioteca,
    codigoProjeto: string | null,
    factory: RepositoryFactoryInterface,
): Promise<void> {
    const autenticado = exigirAutenticado(usuario);
    const gere = temPermissao(autenticado, Permissao.BIBLIOTECA_GERIR);
    if (!gere && sigilo === SigiloBiblioteca.GESTAO) throw new ErroProibido(MENSAGENS_DE_ERRO.BIBLIOTECA.SIGILO_SEM_PERMISSAO);
    if (!codigoProjeto) return;
    // Ligar a projeto: só a um que a pessoa abre (vale também para quem gere a Biblioteca). Inexistente: 404 para
    // quem gere; para os demais, o mesmo 403 do projeto alheio (como antes da 31a).
    const projeto = await factory.criarProjetoRepository().buscarPorCodigo(codigoProjeto);
    if (!projeto && gere) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);
    if (!projeto || acessoAoProjeto(autenticado, projeto) !== "completo") {
        throw new ErroProibido(MENSAGENS_DE_ERRO.BIBLIOTECA.PROJETO_SEM_PERMISSAO);
    }
}
