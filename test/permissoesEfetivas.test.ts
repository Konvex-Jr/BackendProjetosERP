import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import Usuario from "../source/domain/entity/Usuario";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import {
    PADRAO_GERENTE,
    PADRAO_MEMBRO,
    PADRAO_TRAINEE,
    Permissao,
    TODAS_AS_PERMISSOES,
} from "../source/shared/seguranca/catalogoPermissoes";
import { permissoesEfetivas } from "../source/shared/seguranca/permissoesEfetivas";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ordenar = (l: readonly string[]) => [...l].sort();

async function contexto(status: StatusPessoa = StatusPessoa.ATIVO) {
    const f = new MemoryRepositoryFactory();
    const pessoa = (await f
        .criarUsuarioRepository()
        .criar(new Usuario("Ina", "ina@konvex.com.br", true, "h", null, "usr-ina", { status })))!;
    const inovacao = await f.criarAreaRepository().criar(new Area("Inovação"));
    const gerenteInovacao = await f
        .criarCargoRepository()
        .criar(new Cargo("Gerente de inovação", true, "cargo-gi", true, 20, 3, PADRAO_GERENTE));
    const darPeriodo = (cargo: Cargo | null, fim: Date | null = null) =>
        f.criarPeriodoAreaRepository().criar(new PeriodoArea(pessoa.codigo, inovacao, cargo, dia("2026-01-01"), fim, null));
    return { f, pessoa, inovacao, gerenteInovacao, darPeriodo };
}

describe("permissoesEfetivas (sessão 31a)", () => {
    test("sem período: conjunto sem_cargo e cargo nulo", async () => {
        const { f, pessoa } = await contexto();
        const efetivas = await permissoesEfetivas(pessoa, f);
        expect(ordenar(efetivas.permissoes)).toEqual(ordenar(PADRAO_MEMBRO));
        expect(efetivas.cargo).toBeNull();
    });

    test("período aberto com cargo: permissões do cargo e área do período", async () => {
        const { f, pessoa, inovacao, gerenteInovacao, darPeriodo } = await contexto();
        await darPeriodo(gerenteInovacao);
        const efetivas = await permissoesEfetivas(pessoa, f);
        expect(ordenar(efetivas.permissoes)).toEqual(ordenar(PADRAO_GERENTE));
        expect(efetivas.cargo).toEqual({ codigo: "cargo-gi", nome: "Gerente de inovação", posicao: 3, codigoArea: inovacao.codigo });
    });

    test("mudança no cargo vale na leitura seguinte", async () => {
        const { f, pessoa, gerenteInovacao, darPeriodo } = await contexto();
        await darPeriodo(gerenteInovacao);
        const semRelatorios = PADRAO_GERENTE.filter((p) => p !== Permissao.ESTRATEGIA_VER);
        await f.criarCargoRepository().editar(new Cargo("Gerente de inovação", true, "cargo-gi", true, 20, 3, semRelatorios));
        expect((await permissoesEfetivas(pessoa, f)).permissoes).not.toContain(Permissao.ESTRATEGIA_VER);
    });

    test("trainee com cargo recebe o conjunto trainee", async () => {
        const { f, pessoa, gerenteInovacao, darPeriodo } = await contexto(StatusPessoa.TRAINEE);
        await darPeriodo(gerenteInovacao);
        const efetivas = await permissoesEfetivas(pessoa, f);
        expect(ordenar(efetivas.permissoes)).toEqual(ordenar(PADRAO_TRAINEE));
    });

    test("fora da EJ: nada", async () => {
        const { f, pessoa, gerenteInovacao, darPeriodo } = await contexto(StatusPessoa.INATIVO);
        await darPeriodo(gerenteInovacao);
        expect(await permissoesEfetivas(pessoa, f)).toEqual({ permissoes: [], cargo: null });
    });

    test("cargo de presidente pode tudo, mesmo com a lista gravada vazia", async () => {
        const { f, pessoa, darPeriodo } = await contexto();
        const presidente = await f.criarCargoRepository().criar(new Cargo("Presidente", true, "cargo-pres", true, 20, 1, []));
        await darPeriodo(presidente);
        expect(ordenar((await permissoesEfetivas(pessoa, f)).permissoes)).toEqual(ordenar(TODAS_AS_PERMISSOES));
    });

    test("período encerrado não conta", async () => {
        const { f, pessoa, gerenteInovacao, darPeriodo } = await contexto();
        await darPeriodo(gerenteInovacao, dia("2026-02-01"));
        const efetivas = await permissoesEfetivas(pessoa, f);
        expect(efetivas.cargo).toBeNull();
        expect(ordenar(efetivas.permissoes)).toEqual(ordenar(PADRAO_MEMBRO));
    });
});
