import Area from "../../domain/Entity/Area";
import Iniciativa from "../../domain/Entity/Iniciativa";
import Usuario from "../../domain/Entity/Usuario";
import { ErroProibido } from "../erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { normalizarBusca } from "../texto";
import { Permissao } from "./catalogoPermissoes";
import { exigirAutenticado, temPermissao, UsuarioAutenticado } from "./permissoes";

/**
 * Iniciativas de inovação (decisões de 03/11/2026, sessão 12b):
 * - ler: qualquer pessoa logada (todas visíveis para todos);
 * - criar: gestão (iniciativas.gerir) ou quem é da área de Inovação (ou de uma subárea dela);
 * - editar e excluir: responsável, quem criou ou a gestão.
 */

/** A área (ou uma das áreas acima dela) tem "Inovação" no nome, sem diferenciar acento ou maiúsculas. */
export function ehDaAreaDeInovacao(pessoa: Usuario | null | undefined, areas: Area[]): boolean {
    let codigo: string | null = pessoa?.area?.codigo ?? null;
    const vistas = new Set<string>();
    while (codigo && !vistas.has(codigo)) {
        vistas.add(codigo);
        const area = areas.find((a) => a.codigo === codigo);
        if (!area) return false;
        if (normalizarBusca(area.nome).includes("inovacao")) return true;
        codigo = area.codigoAreaPai;
    }
    return false;
}

export function podeCriarIniciativa(usuario: UsuarioAutenticado | null | undefined, pessoa: Usuario | null, areas: Area[]): boolean {
    if (!usuario) return false;
    return temPermissao(usuario, Permissao.INICIATIVAS_GERIR) || ehDaAreaDeInovacao(pessoa, areas);
}

export function podeAlterarIniciativa(usuario: UsuarioAutenticado | null | undefined, item: Iniciativa): boolean {
    if (!usuario) return false;
    return (
        item.responsavel?.codigo === usuario.codigo ||
        item.criadoPor?.codigo === usuario.codigo ||
        temPermissao(usuario, Permissao.INICIATIVAS_GERIR)
    );
}

export function exigirAlterarIniciativa(usuario: UsuarioAutenticado | null | undefined, item: Iniciativa): UsuarioAutenticado {
    const autenticado = exigirAutenticado(usuario);
    if (!podeAlterarIniciativa(autenticado, item)) throw new ErroProibido(MENSAGENS_DE_ERRO.INICIATIVA.SEM_PERMISSAO);
    return autenticado;
}
