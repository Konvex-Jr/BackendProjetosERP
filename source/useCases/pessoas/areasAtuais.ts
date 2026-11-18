import Usuario, { AreaAtual } from "../../domain/entity/Usuario";
import { STATUS_NA_EJ } from "../../domain/enum/StatusPessoa";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";

export type { AreaAtual };

/**
 * Devolve as pessoas com `areas` = seus períodos em aberto, numa consulta só para a lista toda.
 * Só quem está na EJ (STATUS_NA_EJ) tem área atual: período aberto de quem saiu é dado
 * incoerente e não conta (spec 23, seção 5.2).
 */
export async function preencherAreasAtuais(factory: RepositoryFactoryInterface, usuarios: Usuario[]): Promise<Usuario[]> {
    const naEj = usuarios.filter((u) => STATUS_NA_EJ.includes(u.status)).map((u) => u.codigo);
    const abertos = naEj.length ? await factory.criarPeriodoAreaRepository().listarAbertosDe(naEj) : [];

    const porPessoa = new Map<string, AreaAtual[]>();
    for (const p of abertos) {
        const lista = porPessoa.get(p.codigoUsuario) ?? [];
        lista.push({ area: p.area, cargo: p.cargo, inicio: p.inicio, codigoPeriodo: p.codigo });
        porPessoa.set(p.codigoUsuario, lista);
    }

    return usuarios.map((u) => {
        const areas = STATUS_NA_EJ.includes(u.status) ? (porPessoa.get(u.codigo) ?? []) : [];
        return u.copiar({ areas });
    });
}

/** Uma pessoa só (rotas que devolvem a pessoa). */
export async function comAreasAtuais(factory: RepositoryFactoryInterface, usuario: Usuario): Promise<Usuario> {
    return (await preencherAreasAtuais(factory, [usuario]))[0];
}
