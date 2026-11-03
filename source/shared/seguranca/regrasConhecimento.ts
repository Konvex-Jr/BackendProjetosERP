import Conhecimento from "../../domain/Entity/Conhecimento";
import { ErroProibido } from "../erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { Permissao } from "./catalogoPermissoes";
import { exigirAutenticado, temPermissao, UsuarioAutenticado } from "./permissoes";

/**
 * Base de Inteligência (decisões de 03/11/2026, sessão 12a):
 * - ler e cadastrar: qualquer pessoa logada (só pessoas Ativas têm login);
 * - editar e excluir: quem cadastrou o item ou quem tem conhecimento.gerir (gestão).
 */
export function podeAlterarConhecimento(usuario: UsuarioAutenticado | null | undefined, item: Conhecimento): boolean {
    if (!usuario) return false;
    return item.autor?.codigo === usuario.codigo || temPermissao(usuario, Permissao.CONHECIMENTO_GERIR);
}

export function exigirAlterarConhecimento(usuario: UsuarioAutenticado | null | undefined, item: Conhecimento): UsuarioAutenticado {
    const autenticado = exigirAutenticado(usuario);
    if (!podeAlterarConhecimento(autenticado, item)) {
        throw new ErroProibido(MENSAGENS_DE_ERRO.CONHECIMENTO.SEM_PERMISSAO);
    }
    return autenticado;
}
