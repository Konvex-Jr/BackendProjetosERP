import ItemBiblioteca from "../../domain/entity/ItemBiblioteca";
import SigiloBiblioteca from "../../domain/enum/SigiloBiblioteca";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../erros/ErroNaoEncontrado";
import { ErroProibido } from "../erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { Permissao } from "./catalogoPermissoes";
import { exigirAutenticado, temPermissao, UsuarioAutenticado } from "./permissoes";
import { acessoAoProjeto, podeVerTodosProjetos } from "./visibilidadeProjetos";

/** Projetos da pessoa e projetos sigilosos que ela não pode ver (sessão 20). */
export interface ContextoProjetos {
    /** Projetos com acesso completo vindos de participação (atual ou passada). */
    meus: Set<string>;
    /** Projetos sigilosos que a pessoa não vê por inteiro: itens ligados a eles somem, para todos os papéis. */
    ocultos: Set<string>;
}

/**
 * Quem lê e altera itens da Biblioteca (sessão 17). Gestão (biblioteca.verTodos) lê todos;
 * os demais leem os itens "todos" e os de projeto de que participam ou participaram.
 * Item invisível se comporta como inexistente (404). Alterar: autor ou biblioteca.gerir.
 */
export function podeVerTodosItens(usuario: UsuarioAutenticado | undefined | null): boolean {
    return temPermissao(usuario, Permissao.BIBLIOTECA_VER_TODOS);
}

export function podeVerItem(usuario: UsuarioAutenticado, item: ItemBiblioteca, ctx: ContextoProjetos): boolean {
    // Projeto sigiloso oculto vale até para a gestão: vem antes de qualquer atalho.
    if (item.projeto && ctx.ocultos.has(item.projeto.codigo)) return false;
    if (podeVerTodosItens(usuario)) return true;
    if (item.sigilo === SigiloBiblioteca.TODOS) return true;
    if (item.sigilo === SigiloBiblioteca.PROJETO) return !!item.projeto && ctx.meus.has(item.projeto.codigo);
    // Sigilo "gestao" (ou valor desconhecido): só quem passou na primeira checagem.
    return false;
}

export function podeAlterarItem(usuario: UsuarioAutenticado | null | undefined, item: ItemBiblioteca): boolean {
    if (!usuario) return false;
    return item.autor?.codigo === usuario.codigo || temPermissao(usuario, Permissao.BIBLIOTECA_GERIR);
}

/**
 * Projetos da pessoa (`meus`: acesso completo entre os de que participa ou participou) e sigilosos
 * ocultos. `meus` fica vazio para quem tem
 * biblioteca.verTodos, que não precisa dele; `ocultos` é calculado para todos.
 */
export async function contextoProjetos(usuario: UsuarioAutenticado, factory: RepositoryFactoryInterface): Promise<ContextoProjetos> {
    const repo = factory.criarProjetoRepository();
    const ocultos = new Set((await repo.listarSigilosos()).filter((p) => acessoAoProjeto(usuario, p) !== "completo").map((p) => p.codigo));
    const meus = new Set<string>();
    if (!podeVerTodosItens(usuario)) {
        for (const p of await repo.listarPorMembro(usuario.codigo)) if (acessoAoProjeto(usuario, p) === "completo") meus.add(p.codigo);
    }
    return { meus, ocultos };
}

/**
 * Se a pessoa pode ver o projeto ligado a um item (Ruling 8): sigiloso oculto nunca; senão projetos.verTodos
 * ou projeto dela. Quem tivesse biblioteca.verTodos sem projetos.verTodos veria todos os projetos
 * não ocultos como nulos, o lado seguro.
 */
export function podeVerProjetoDoItem(usuario: UsuarioAutenticado, codigoProjeto: string, ctx: ContextoProjetos): boolean {
    if (ctx.ocultos.has(codigoProjeto)) return false;
    return podeVerTodosProjetos(usuario) || ctx.meus.has(codigoProjeto);
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
 * ligar a um projeto exige biblioteca.gerir ou participar/ter participado dele.
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
    const ctx = await contextoProjetos(autenticado, factory);
    // Sigiloso oculto: nem quem gere a Biblioteca liga item a ele.
    if (ctx.ocultos.has(codigoProjeto)) throw new ErroProibido(MENSAGENS_DE_ERRO.BIBLIOTECA.PROJETO_SEM_PERMISSAO);
    if (gere) return;
    if (!ctx.meus.has(codigoProjeto)) throw new ErroProibido(MENSAGENS_DE_ERRO.BIBLIOTECA.PROJETO_SEM_PERMISSAO);
}
