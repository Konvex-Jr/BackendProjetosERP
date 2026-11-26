import { ErroProibido } from "../erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { exigirPermissao, Permissao, UsuarioAutenticado } from "./permissoes";

/*
 * Hierarquia dos cargos (spec 31a, 5.3). Posição: 1 = presidente; menor = mais alto. Sem cargo fica abaixo
 * de todos. Cada um só mexe no que está ABAIXO do seu cargo; o presidente mexe em tudo.
 */

export function posicaoDe(usuario: Pick<UsuarioAutenticado, "cargo"> | null | undefined): number {
    return usuario?.cargo?.posicao ?? Infinity;
}

export function ehPresidente(usuario: Pick<UsuarioAutenticado, "cargo"> | null | undefined): boolean {
    return usuario?.cargo?.posicao === 1;
}

/** Quem está acima de uma posição (o presidente está acima de tudo, inclusive da própria posição). */
export function estaAcima(quem: Pick<UsuarioAutenticado, "cargo">, posicaoAlvo: number): boolean {
    return ehPresidente(quem) || posicaoDe(quem) < posicaoAlvo;
}

/** Pessoa como a hierarquia precisa dela: o código e a posição do cargo atual (nula = sem cargo). */
export interface AlvoDaHierarquia {
    codigo: string;
    cargo: { posicao: number } | null;
}

/**
 * Gerir uma pessoa (cadastro, status, períodos): `pessoas.gerir` e a pessoa abaixo do seu cargo.
 * O próprio cadastro, pela gestão, só o presidente. Substitui `pessoas.gerirDiretores`.
 */
export function exigirGerirPessoa(usuario: UsuarioAutenticado | undefined | null, alvo: AlvoDaHierarquia): UsuarioAutenticado {
    const quem = exigirPermissao(usuario, Permissao.PESSOAS_GERIR, MENSAGENS_DE_ERRO.HIERARQUIA.SEM_GERIR_PESSOAS);
    if (quem.codigo === alvo.codigo) {
        if (!ehPresidente(quem)) throw new ErroProibido(MENSAGENS_DE_ERRO.HIERARQUIA.PROPRIO);
        return quem;
    }
    if (!estaAcima(quem, alvo.cargo?.posicao ?? Infinity)) throw new ErroProibido(MENSAGENS_DE_ERRO.HIERARQUIA.PESSOA_ACIMA);
    return quem;
}

/** Versão sem erro, para montar `podeGerir` nas respostas. */
export function podeGerirPessoa(usuario: UsuarioAutenticado | undefined | null, alvo: AlvoDaHierarquia): boolean {
    try {
        exigirGerirPessoa(usuario, alvo);
        return true;
    } catch {
        return false;
    }
}
