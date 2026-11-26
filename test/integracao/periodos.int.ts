/**
 * Períodos da pessoa nas áreas contra PostgreSQL de verdade (sessão 23a).
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import Usuario from "../../source/domain/entity/Usuario";
import SenioridadeUsuario from "../../source/domain/entity/SenioridadeUsuario";
import Area from "../../source/domain/entity/Area";
import Cargo from "../../source/domain/entity/Cargo";
import PeriodoArea from "../../source/domain/entity/PeriodoArea";
import { ErroValidacao } from "../../source/shared/erros/ErroValidacao";
import { preencherAreasAtuais } from "../../source/useCases/pessoas/areasAtuais";
import ListarUsuarios from "../../source/useCases/pessoas/ListarUsuarios";
import { comPapel } from "../papel";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

descrever("períodos nas áreas contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let factory: DatabaseRepositoryFactory;
    let projetos: Area;
    let marketing: Area;
    let gerente: Cargo;

    async function novaPessoa(nome: string): Promise<Usuario> {
        const pessoa = comPapel(
            new Usuario(nome, `${nome.toLowerCase()}@teste.com`, true, "hash", new SenioridadeUsuario("pleno", "Pleno", 75)),
            "membro",
        );
        await factory.criarUsuarioRepository().criar(pessoa);
        return pessoa;
    }

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        conexao = PgConexao.criar(URL_TESTE!);
        factory = new DatabaseRepositoryFactory(conexao);
        projetos = await factory.criarAreaRepository().criar(new Area("Projetos"));
        marketing = await factory.criarAreaRepository().criar(new Area("Marketing"));
        gerente = await factory.criarCargoRepository().criar(new Cargo("Gerente de Projetos", true, undefined, true));
    }, 60000);

    afterAll(async () => {
        await conexao?.encerrar();
        await pool?.end();
    });

    test("cargo grava e lê lidera_area", async () => {
        const cargos = factory.criarCargoRepository();
        expect((await cargos.buscarPorCodigo(gerente.codigo))!.lideraArea).toBe(true);
        const assessor = await cargos.criar(new Cargo("Assessor"));
        expect((await cargos.buscarPorCodigo(assessor.codigo))!.lideraArea).toBe(false);
        await cargos.editar(new Cargo("Assessor", true, assessor.codigo, true));
        expect((await cargos.buscarPorCodigo(assessor.codigo))!.lideraArea).toBe(true);
    });

    test("cria, lista e edita períodos; a pessoa lida traz as áreas atuais", async () => {
        const ana = await novaPessoa("Ana");
        const repo = factory.criarPeriodoAreaRepository();
        const antigo = await repo.criar(new PeriodoArea(ana.codigo, marketing, null, dia("2025-01-10"), dia("2026-01-10"), ana.codigo));
        const atual = await repo.criar(new PeriodoArea(ana.codigo, projetos, gerente, dia("2026-01-10"), null, null));

        const lidos = await repo.listarDe(ana.codigo);
        // Abertos primeiro, depois por início decrescente.
        expect(lidos.map((p) => p.codigo)).toEqual([atual.codigo, antigo.codigo]);
        expect(lidos[0].cargo?.nome).toBe("Gerente de Projetos");
        expect(lidos[0].cargo?.lideraArea).toBe(true);
        expect(lidos[0].area.nome).toBe("Projetos");
        expect(lidos[1].fim).toEqual(dia("2026-01-10"));
        expect(lidos[1].codigoRegistradoPor).toBe(ana.codigo);

        const editado = lidos[1].copiar({ inicio: dia("2025-02-01"), cargo: gerente });
        await repo.editar(editado);
        const relido = (await repo.buscarPorCodigo(antigo.codigo))!;
        expect(relido.inicio).toEqual(dia("2025-02-01"));
        expect(relido.cargo?.codigo).toBe(gerente.codigo);
        expect(await repo.buscarPorCodigo(crypto.randomUUID())).toBeNull();

        const [preenchida] = await preencherAreasAtuais(factory, [(await factory.criarUsuarioRepository().buscarPorCodigo(ana.codigo))!]);
        expect(preenchida.areas.map((a) => [a.area.nome, a.cargo?.nome, a.codigoPeriodo])).toEqual([
            ["Projetos", "Gerente de Projetos", atual.codigo],
        ]);
        const porArea = await new ListarUsuarios(factory).execute({ codigoArea: projetos.codigo });
        expect(porArea.map((u) => u.codigo)).toEqual([ana.codigo]);
        expect(await new ListarUsuarios(factory).execute({ codigoArea: marketing.codigo })).toEqual([]);

        await repo.excluir(antigo.codigo);
        expect((await repo.listarDe(ana.codigo)).map((p) => p.codigo)).toEqual([atual.codigo]);
    });

    test("duas gravações simultâneas sobrepostas: uma passa, a outra vira PERIODO_SOBREPOSTO", async () => {
        const bia = await novaPessoa("Bia");
        const repo = factory.criarPeriodoAreaRepository();
        const resultados = await Promise.allSettled([
            repo.criar(new PeriodoArea(bia.codigo, projetos, null, dia("2026-01-01"), null, null)),
            repo.criar(new PeriodoArea(bia.codigo, projetos, null, dia("2026-03-01"), null, null)),
        ]);
        expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const falha = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
        expect(falha.reason).toBeInstanceOf(ErroValidacao);
        expect(falha.reason.codigo).toBe("PERIODO_SOBREPOSTO");
        expect(falha.reason.message).toMatch(/em aberto/);
        // Outra área, ao mesmo tempo, pode.
        await repo.criar(new PeriodoArea(bia.codigo, marketing, null, dia("2026-01-01"), null, null));
        expect(await repo.listarAbertosDe([bia.codigo])).toHaveLength(2);
    });

    test("encerrarAbertosDe grava o fim, nunca antes de início + 1 dia", async () => {
        const caio = await novaPessoa("Caio");
        const repo = factory.criarPeriodoAreaRepository();
        const p1 = await repo.criar(new PeriodoArea(caio.codigo, projetos, null, dia("2026-03-01"), null, null));
        const p2 = await repo.criar(new PeriodoArea(caio.codigo, marketing, null, dia("2026-01-01"), null, null));
        const fechado = await repo.criar(new PeriodoArea(caio.codigo, marketing, null, dia("2025-01-01"), dia("2025-06-01"), null));

        expect(await repo.encerrarAbertosDe(caio.codigo, dia("2026-03-01"))).toBe(2);
        expect((await repo.buscarPorCodigo(p1.codigo))!.fim).toEqual(dia("2026-03-02"));
        expect((await repo.buscarPorCodigo(p2.codigo))!.fim).toEqual(dia("2026-03-01"));
        expect((await repo.buscarPorCodigo(fechado.codigo))!.fim).toEqual(dia("2025-06-01"));
        expect(await repo.listarAbertosDe([caio.codigo])).toEqual([]);
        expect(await repo.encerrarAbertosDe(caio.codigo, dia("2026-03-01"))).toBe(0);
    });
});
