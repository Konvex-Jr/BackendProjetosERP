import Pasta from "../../domain/Entity/Pasta";
import SigiloPasta from "../../domain/Enum/SigiloPasta";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../erros/ErroNaoEncontrado";
import { exigirAutenticado, Permissao, temPermissao, UsuarioAutenticado } from "./permissoes";

/**
 * Quem lê qual pasta (sessão 9, decisão de 03/11/2026). Gestão (documentos.verTodas)
 * lê todas; os demais leem as pastas "todos" e as de projeto de que participam ou participaram.
 * Pasta invisível se comporta como inexistente (404), como a tarefa avulsa.
 */
export function podeVerTodasPastas(usuario: UsuarioAutenticado | undefined | null): boolean {
    return temPermissao(usuario, Permissao.DOCUMENTOS_VER_TODAS);
}

export function podeVerPasta(usuario: UsuarioAutenticado, pasta: Pasta, meusProjetos: ReadonlySet<string>): boolean {
    if (podeVerTodasPastas(usuario)) return true;
    if (pasta.sigilo === SigiloPasta.TODOS) return true;
    if (pasta.sigilo === SigiloPasta.PROJETO) return !!pasta.projeto && meusProjetos.has(pasta.projeto.codigo);
    return false;
}

/** Códigos dos projetos de que a pessoa participa ou participou (só consulta se precisar). */
export async function projetosDoUsuario(usuario: UsuarioAutenticado, factory: RepositoryFactoryInterface): Promise<Set<string>> {
    if (podeVerTodasPastas(usuario)) return new Set();
    const projetos = await factory.criarProjetoRepository().listarPorMembro(usuario.codigo);
    return new Set(projetos.map((p) => p.codigo));
}

export async function filtrarPastasVisiveis(
    usuario: UsuarioAutenticado | undefined | null,
    pastas: Pasta[],
    factory: RepositoryFactoryInterface,
): Promise<Pasta[]> {
    const autenticado = exigirAutenticado(usuario);
    const meus = await projetosDoUsuario(autenticado, factory);
    return pastas.filter((p) => podeVerPasta(autenticado, p, meus));
}

export async function exigirVerPasta(
    usuario: UsuarioAutenticado | undefined | null,
    pasta: Pasta | null,
    factory: RepositoryFactoryInterface,
): Promise<Pasta> {
    const autenticado = exigirAutenticado(usuario);
    if (pasta && podeVerPasta(autenticado, pasta, await projetosDoUsuario(autenticado, factory))) return pasta;
    throw new ErroNaoEncontrado("Pasta não encontrada.");
}
