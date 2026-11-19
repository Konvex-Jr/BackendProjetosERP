import Area from "../../domain/entity/Area";
import PeriodoArea from "../../domain/entity/PeriodoArea";
import PerfilUsuario from "../../domain/enum/PerfilUsuario";
import { STATUS_NA_EJ } from "../../domain/enum/StatusPessoa";
import { UsuarioAutenticado } from "./permissoes";

/*
 * Liderança das áreas (spec 23, seção 5.3).
 * Regra provisória; as lideranças da EJ vão decidir a definitiva (18/11/2026).
 * Por isso ela fica toda aqui: quem precisa saber se alguém lidera uma área pergunta a este arquivo.
 *
 * Lidera a área quem tem o papel diretor do sistema, ou um período em aberto com cargo que lidera
 * (`Cargo.lideraArea`) nesta área ou em alguma acima dela.
 */

/** Períodos que dão liderança: em aberto, da própria pessoa, com cargo que lidera. */
function periodosDeLideranca(usuario: UsuarioAutenticado, periodosAbertos: PeriodoArea[]): PeriodoArea[] {
    return periodosAbertos.filter((p) => p.aberto && p.codigoUsuario === usuario.codigo && p.cargo?.lideraArea === true);
}

/** Fora da EJ ninguém lidera (defesa contra período aberto de quem saiu). Sem status informado, vale. */
function naEj(usuario: UsuarioAutenticado): boolean {
    return usuario.status === undefined || STATUS_NA_EJ.includes(usuario.status as never);
}

/** A área e as que estão acima dela, subindo pela área pai; para num ciclo do dado. */
function areaEAcima(codigoArea: string, areas: Area[]): string[] {
    const porCodigo = new Map(areas.map((a) => [a.codigo, a]));
    const caminho: string[] = [];
    let atual: string | null = codigoArea;
    while (atual && !caminho.includes(atual)) {
        caminho.push(atual);
        atual = porCodigo.get(atual)?.codigoAreaPai ?? null;
    }
    return caminho;
}

export function lideraArea(usuario: UsuarioAutenticado, codigoArea: string, areas: Area[], periodosAbertos: PeriodoArea[]): boolean {
    if (!naEj(usuario)) return false;
    if (usuario.perfil === PerfilUsuario.DIRETOR) return true;
    const acima = new Set(areaEAcima(codigoArea, areas));
    return periodosDeLideranca(usuario, periodosAbertos).some((p) => acima.has(p.area.codigo));
}

/** Códigos das áreas que a pessoa lidera: as dos seus períodos de liderança e todas abaixo delas. */
export function areasLideradas(usuario: UsuarioAutenticado, areas: Area[], periodosAbertos: PeriodoArea[]): Set<string> {
    if (!naEj(usuario)) return new Set();
    if (usuario.perfil === PerfilUsuario.DIRETOR) return new Set(areas.map((a) => a.codigo));
    const raizes = new Set(periodosDeLideranca(usuario, periodosAbertos).map((p) => p.area.codigo));
    return new Set(areas.filter((a) => areaEAcima(a.codigo, areas).some((c) => raizes.has(c))).map((a) => a.codigo));
}

/** Códigos de quem lidera a área hoje: período aberto com cargo que lidera na área ou em alguma acima dela. */
export function lideresDaArea(codigoArea: string, areas: Area[], periodosAbertos: PeriodoArea[]): string[] {
    const acima = new Set(areaEAcima(codigoArea, areas));
    const lideres = periodosAbertos
        .filter((p) => p.aberto && p.cargo?.lideraArea === true && acima.has(p.area.codigo))
        .map((p) => p.codigoUsuario);
    return [...new Set(lideres)];
}
