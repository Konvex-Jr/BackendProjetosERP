import PerfilUsuario from "../../domain/Enum/PerfilUsuario";
import { ErroNaoAutorizado } from "../erros/ErroNaoAutorizado";
import { ErroProibido } from "../erros/ErroProibido";

/**
 * Permissões fixas por papel, checadas no backend (RF-002).
 * Correspondência com a documentação: diretor = ADMIN, gerente = MANAGER, membro = MEMBER.
 */
export interface UsuarioAutenticado {
    codigo: string;
    perfil: PerfilUsuario | string;
}

export const GESTORES: PerfilUsuario[] = [PerfilUsuario.DIRETOR, PerfilUsuario.GERENTE];

export function exigirAutenticado(usuario: UsuarioAutenticado | undefined | null): UsuarioAutenticado {
    if (!usuario || !usuario.codigo) {
        throw new ErroNaoAutorizado();
    }
    return usuario;
}

export function ehGestor(usuario: UsuarioAutenticado | undefined | null): boolean {
    return !!usuario && GESTORES.includes(usuario.perfil as PerfilUsuario);
}

export function ehDiretor(usuario: UsuarioAutenticado | undefined | null): boolean {
    return !!usuario && usuario.perfil === PerfilUsuario.DIRETOR;
}

export function exigirPerfil(
    usuario: UsuarioAutenticado | undefined | null,
    perfis: PerfilUsuario[],
    mensagem?: string,
): UsuarioAutenticado {
    const autenticado = exigirAutenticado(usuario);
    if (!perfis.includes(autenticado.perfil as PerfilUsuario)) {
        throw new ErroProibido(mensagem);
    }
    return autenticado;
}

export function exigirGestor(usuario: UsuarioAutenticado | undefined | null, mensagem?: string): UsuarioAutenticado {
    return exigirPerfil(usuario, GESTORES, mensagem ?? "Somente diretores e gerentes podem fazer esta alteração.");
}

export function exigirDiretor(usuario: UsuarioAutenticado | undefined | null, mensagem?: string): UsuarioAutenticado {
    return exigirPerfil(usuario, [PerfilUsuario.DIRETOR], mensagem ?? "Somente diretores podem fazer esta alteração.");
}

/**
 * Resolve em nome de quem a ação é feita. Membros só agem por si mesmos;
 * gestores podem indicar outra pessoa (por exemplo, inscrever alguém numa capacitação).
 */
export function resolverUsuarioAlvo(
    usuario: UsuarioAutenticado | undefined | null,
    codigoInformado?: string | null,
): string {
    const autenticado = exigirAutenticado(usuario);
    if (!codigoInformado || codigoInformado === autenticado.codigo) {
        return autenticado.codigo;
    }
    if (!ehGestor(autenticado)) {
        throw new ErroProibido("Você só pode realizar esta ação em seu próprio nome.");
    }
    return codigoInformado;
}

/**
 * Um gerente não pode criar, promover nem alterar um diretor; só um diretor pode.
 */
export function exigirPodeGerirPerfil(
    usuario: UsuarioAutenticado | undefined | null,
    perfilDoAlvoAtual: PerfilUsuario | string | null,
    perfilDesejado: PerfilUsuario | string | null,
): UsuarioAutenticado {
    const gestor = exigirGestor(usuario, "Somente diretores e gerentes podem gerenciar pessoas.");
    if (ehDiretor(gestor)) {
        return gestor;
    }
    if (perfilDoAlvoAtual === PerfilUsuario.DIRETOR || perfilDesejado === PerfilUsuario.DIRETOR) {
        throw new ErroProibido("Somente diretores podem criar, alterar ou promover diretores.");
    }
    return gestor;
}
