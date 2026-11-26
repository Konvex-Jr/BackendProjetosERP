import StatusPessoa from "../../domain/enum/StatusPessoa";
import { ErroNaoAutorizado } from "../erros/ErroNaoAutorizado";
import { ErroProibido } from "../erros/ErroProibido";
import { Permissao } from "./catalogoPermissoes";
import { CargoDaPessoa } from "./permissoesEfetivas";

export { Permissao } from "./catalogoPermissoes";

/**
 * Checagem de permissões no backend (RF-002), sempre por ação do catálogo
 * (ver catalogoPermissoes.ts), nunca por papel.
 */
export interface UsuarioAutenticado {
    codigo: string;
    /** Lido do banco a cada requisição: trainee que vira Ativo vale já na próxima chamada. */
    status?: StatusPessoa | string;
    /**
     * Permissões efetivas (sessão 31a), calculadas a cada requisição pelo AuthExpress a partir do cargo
     * (ver permissoesEfetivas.ts): mudar a grade vale no próximo clique. Ausente = nenhuma (na dúvida, nega).
     */
    permissoes?: readonly Permissao[];
    /** Cargo atual (período aberto com cargo); nulo = sem cargo. */
    cargo?: CargoDaPessoa | null;
}

const MENSAGEM_PADRAO = "Você não tem permissão para fazer esta alteração.";

/**
 * 401 se não houver pessoa logada. As rotas com login já passam pelo middleware; esta checagem
 * garante que o caso de uso também não rode sem pessoa quando chamado de outro lugar (ex.: testes).
 */
export function exigirAutenticado(usuario: UsuarioAutenticado | undefined | null): UsuarioAutenticado {
    if (!usuario || !usuario.codigo) {
        throw new ErroNaoAutorizado();
    }
    return usuario;
}

/** Trainee (sessão 20): entra no sistema como membro, mas sem Biblioteca nem liderança. */
export function ehTrainee(usuario: UsuarioAutenticado | undefined | null): boolean {
    return !!usuario && usuario.status === StatusPessoa.TRAINEE;
}

/** 401 sem pessoa logada; 403 (com a mensagem informada) para trainee. */
export function exigirNaoTrainee(usuario: UsuarioAutenticado | undefined | null, mensagem: string): UsuarioAutenticado {
    const autenticado = exigirAutenticado(usuario);
    if (ehTrainee(autenticado)) throw new ErroProibido(mensagem);
    return autenticado;
}

/** Versão que não lança erro: serve para montar os booleanos das respostas (podeGerir, podeAlterar...). */
export function temPermissao(usuario: UsuarioAutenticado | undefined | null, permissao: Permissao): boolean {
    return !!usuario && (usuario.permissoes ?? []).includes(permissao);
}

/** 401 sem pessoa logada; 403 (com a mensagem informada) se o papel não tiver a ação. */
export function exigirPermissao(
    usuario: UsuarioAutenticado | undefined | null,
    permissao: Permissao,
    mensagem: string = MENSAGEM_PADRAO,
): UsuarioAutenticado {
    const autenticado = exigirAutenticado(usuario);
    if (!temPermissao(autenticado, permissao)) {
        throw new ErroProibido(mensagem);
    }
    return autenticado;
}

/**
 * Resolve em nome de quem a ação é feita. Sem a permissão indicada, a pessoa só age por si;
 * com ela, pode indicar outra pessoa (por exemplo, inscrever alguém numa capacitação).
 */
export function resolverUsuarioAlvo(
    usuario: UsuarioAutenticado | undefined | null,
    codigoInformado: string | null | undefined,
    permissao: Permissao,
): string {
    const autenticado = exigirAutenticado(usuario);
    if (!codigoInformado || codigoInformado === autenticado.codigo) {
        return autenticado.codigo;
    }
    if (!temPermissao(autenticado, permissao)) {
        throw new ErroProibido("Você só pode realizar esta ação em seu próprio nome.");
    }
    return codigoInformado;
}
