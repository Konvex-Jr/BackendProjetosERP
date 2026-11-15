import ItemBiblioteca from "../../domain/entity/ItemBiblioteca";
import SigiloBiblioteca from "../../domain/enum/SigiloBiblioteca";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../erros/ErroNaoEncontrado";
import { ErroProibido } from "../erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { Permissao } from "./catalogoPermissoes";
import { exigirAutenticado, temPermissao, UsuarioAutenticado } from "./permissoes";

/**
 * Quem lê e altera itens da Biblioteca (sessão 17). Gestão (biblioteca.verTodos) lê todos;
 * os demais leem os itens "todos" e os de projeto de que participam ou participaram.
 * Item invisível se comporta como inexistente (404). Alterar: autor ou biblioteca.gerir.
 */
export function podeVerTodosItens(usuario: UsuarioAutenticado | undefined | null): boolean {
    return temPermissao(usuario, Permissao.BIBLIOTECA_VER_TODOS);
}

export function podeVerItem(usuario: UsuarioAutenticado, item: ItemBiblioteca, meusProjetos: ReadonlySet<string>): boolean {
    if (podeVerTodosItens(usuario)) return true;
    if (item.sigilo === SigiloBiblioteca.TODOS) return true;
    if (item.sigilo === SigiloBiblioteca.PROJETO) return !!item.projeto && meusProjetos.has(item.projeto.codigo);
    // Sigilo "gestao" (ou valor desconhecido): só quem passou na primeira checagem.
    return false;
}

export function podeAlterarItem(usuario: UsuarioAutenticado | null | undefined, item: ItemBiblioteca): boolean {
    if (!usuario) return false;
    return item.autor?.codigo === usuario.codigo || temPermissao(usuario, Permissao.BIBLIOTECA_GERIR);
}

/** Códigos dos projetos de que a pessoa participa ou participou (só consulta se precisar). */
export async function projetosDoUsuario(usuario: UsuarioAutenticado, factory: RepositoryFactoryInterface): Promise<Set<string>> {
    if (podeVerTodosItens(usuario)) return new Set();
    const projetos = await factory.criarProjetoRepository().listarPorMembro(usuario.codigo);
    return new Set(projetos.map((p) => p.codigo));
}

export async function exigirVerItem(
    usuario: UsuarioAutenticado | undefined | null,
    item: ItemBiblioteca | null,
    factory: RepositoryFactoryInterface,
): Promise<ItemBiblioteca> {
    const autenticado = exigirAutenticado(usuario);
    if (item && podeVerItem(autenticado, item, await projetosDoUsuario(autenticado, factory))) return item;
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
    if (temPermissao(autenticado, Permissao.BIBLIOTECA_GERIR)) return;
    if (sigilo === SigiloBiblioteca.GESTAO) throw new ErroProibido(MENSAGENS_DE_ERRO.BIBLIOTECA.SIGILO_SEM_PERMISSAO);
    if (!codigoProjeto) return;
    const meus = await projetosDoUsuario(autenticado, factory);
    if (!meus.has(codigoProjeto)) throw new ErroProibido(MENSAGENS_DE_ERRO.BIBLIOTECA.PROJETO_SEM_PERMISSAO);
}
