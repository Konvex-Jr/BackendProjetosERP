import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import RepositoryFactoryInterface from "../source/domain/interfaces/RepositoryFactoryInterface";
import Usuario from "../source/domain/entity/Usuario";
import StatusPessoa, { STATUS_NA_EJ } from "../source/domain/enum/StatusPessoa";
import {
    PADRAO_DIRETOR,
    PADRAO_GERENTE,
    PADRAO_MEMBRO,
    PADRAO_TRAINEE,
    Permissao,
    TODAS_AS_PERMISSOES,
} from "../source/shared/seguranca/catalogoPermissoes";
import { PermissoesDaPessoa } from "../source/shared/seguranca/permissoesEfetivas";

/*
 * Papéis de teste (sessão 31a). O perfil fixo saiu do sistema; os testes que precisam de "um diretor" ou
 * "um gerente" marcam a pessoa com um papel, que vira permissões e cargo com os padrões da migração 030.
 * Unidade: o objeto marcado já serve como UsuarioAutenticado. HTTP: o servidor de teste (servidorTeste.ts)
 * consulta este registro antes de calcular pelo cargo.
 */
export type Papel = "presidente" | "diretor" | "gerente" | "membro";

const PAPEIS = new Map<string, Papel>();

const CARGOS: Record<Papel, PermissoesDaPessoa["cargo"]> = {
    presidente: { codigo: "cargo-presidente-teste", nome: "Presidente", posicao: 1, codigoArea: "area-presidencia-teste" },
    diretor: { codigo: "cargo-diretor-teste", nome: "Diretor", posicao: 2, codigoArea: "area-projetos-teste" },
    gerente: { codigo: "cargo-gerente-teste", nome: "Gerente", posicao: 3, codigoArea: "area-projetos-teste" },
    membro: null,
};

const PERMISSOES: Record<Papel, readonly Permissao[]> = {
    presidente: TODAS_AS_PERMISSOES,
    diretor: PADRAO_DIRETOR,
    gerente: PADRAO_GERENTE,
    membro: PADRAO_MEMBRO,
};

/** Permissões e cargo do papel, respeitando o status (trainee e quem saiu da EJ), como permissoesEfetivas. */
export function efetivasDoPapel(papel: Papel, status?: StatusPessoa | string): PermissoesDaPessoa {
    if (status !== undefined && !STATUS_NA_EJ.includes(status as StatusPessoa)) return { permissoes: [], cargo: null };
    const cargo = CARGOS[papel];
    if (status === StatusPessoa.TRAINEE) return { permissoes: [...PADRAO_TRAINEE], cargo };
    return { permissoes: [...PERMISSOES[papel]], cargo };
}

export function papelDe(codigo: string): Papel | undefined {
    return PAPEIS.get(codigo);
}

/** Marca a pessoa com o papel e devolve o mesmo objeto, já com `permissoes` e `cargo`. */
export function comPapel<T extends Usuario>(usuario: T, papel: Papel): T {
    PAPEIS.set(usuario.codigo, papel);
    return Object.assign(usuario, efetivasDoPapel(papel, usuario.status));
}

/** O usuário logado de um teste de unidade: código, status e as permissões do papel marcado (sem papel = nenhuma). */
export function autenticado(usuario: { codigo: string; status?: StatusPessoa | string }): {
    codigo: string;
    status?: StatusPessoa | string;
} & Partial<PermissoesDaPessoa> {
    const papel = papelDe(usuario.codigo);
    return { codigo: usuario.codigo, status: usuario.status, ...(papel ? efetivasDoPapel(papel, usuario.status) : {}) };
}

const NOMES_CARGO: Record<Papel, string> = { presidente: "Presidente", diretor: "Diretor", gerente: "Gerente", membro: "Membro" };
const POSICOES: Record<Papel, number> = { presidente: 1, diretor: 2, gerente: 3, membro: 4 };

/**
 * Dá à pessoa um cargo de verdade (cargo com os padrões do papel e período aberto numa área de teste), para as
 * regras que olham o cargo de OUTRA pessoa (hierarquia), que não passam pelo registro de papéis.
 */
export async function darCargo(factory: RepositoryFactoryInterface, usuario: Usuario, papel: Papel): Promise<Cargo> {
    const cargos = factory.criarCargoRepository();
    const cargo =
        (await cargos.listar()).find((c) => c.nome === NOMES_CARGO[papel]) ??
        (await cargos.criar(new Cargo(NOMES_CARGO[papel], true, undefined, false, 10, POSICOES[papel], PERMISSOES[papel])));
    const areas = factory.criarAreaRepository();
    const area = (await areas.listar()).find((a) => a.nome === "Área de teste") ?? (await areas.criar(new Area("Área de teste")));
    await factory
        .criarPeriodoAreaRepository()
        .criar(new PeriodoArea(usuario.codigo, area, cargo, new Date("2026-01-01T00:00:00.000Z"), null, null));
    return cargo;
}
