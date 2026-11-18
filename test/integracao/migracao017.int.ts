/**
 * Migração 017 (sessão 23a) sobre um banco já na 016, com pessoas no formato antigo (uma área e um cargo cada).
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;

descrever("migração 017 sobre a 016", () => {
    let pool: Pool;
    let antigas: string;
    const pessoas: Record<string, string> = {};
    const cargos: Record<string, string> = {};
    const areas: Record<string, string> = {};

    async function inserirArea(nome: string, pai: string | null): Promise<string> {
        return (await pool.query("INSERT INTO areas (nome, area_pai_codigo) VALUES ($1, $2) RETURNING codigo", [nome, pai])).rows[0].codigo;
    }

    async function inserirCargo(nome: string): Promise<string> {
        return (await pool.query("INSERT INTO cargos (nome) VALUES ($1) RETURNING codigo", [nome])).rows[0].codigo;
    }

    async function inserirPessoa(
        nome: string,
        status: string,
        area: string | null,
        cargo: string | null,
        entrada: string | null,
        saida: string | null,
    ): Promise<void> {
        pessoas[nome] = (
            await pool.query(
                `INSERT INTO usuarios (nome, email, status, ativo, area_codigo, cargo_codigo, data_entrada, data_saida)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING codigo`,
                [nome, `${nome.toLowerCase()}@teste.konvex`, status, status === "ativo", area, cargo, entrada, saida],
            )
        ).rows[0].codigo;
    }

    async function periodos(nome: string) {
        return (
            await pool.query(
                `SELECT a.nome AS area, c.nome AS cargo, to_char(p.inicio, 'YYYY-MM-DD') AS inicio, to_char(p.fim, 'YYYY-MM-DD') AS fim
                 FROM periodos_area p
                 JOIN areas a ON a.codigo = p.area_codigo
                 LEFT JOIN cargos c ON c.codigo = p.cargo_codigo
                 WHERE p.usuario_codigo = $1 ORDER BY p.inicio`,
                [pessoas[nome]],
            )
        ).rows;
    }

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "017")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);

        areas.projetos = await inserirArea("Projetos", null);
        areas.inovacao = await inserirArea("Inovação", areas.projetos);
        cargos.gerente = await inserirCargo("Gerente de Inovação");
        cargos.diretora = await inserirCargo("Diretora de Projetos");
        cargos.assessor = await inserirCargo("Assessor");

        await inserirPessoa("Ana", "ativo", areas.inovacao, cargos.gerente, "2025-03-01", null);
        await inserirPessoa("Bia", "ativo", areas.projetos, null, null, null);
        await pool.query(
            "INSERT INTO historico_areas (usuario_codigo, area_anterior_codigo, area_nova_codigo, data_vigencia) VALUES ($1, NULL, $2, '2025-08-10')",
            [pessoas.Bia, areas.projetos],
        );
        await inserirPessoa("Caio", "alumni", areas.projetos, cargos.assessor, "2024-02-01", "2025-12-15");
        await inserirPessoa("Duda", "ativo", null, cargos.assessor, null, null);
        await inserirPessoa("Edu", "inativo", areas.projetos, null, "2025-05-05", "2025-05-05");

        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    test("cada pessoa com área vira um período, com o cargo e as datas certas", async () => {
        expect(await periodos("Ana")).toEqual([{ area: "Inovação", cargo: "Gerente de Inovação", inicio: "2025-03-01", fim: null }]);
        expect(await periodos("Bia")).toEqual([{ area: "Projetos", cargo: null, inicio: "2025-08-10", fim: null }]);
        expect(await periodos("Caio")).toEqual([{ area: "Projetos", cargo: "Assessor", inicio: "2024-02-01", fim: "2025-12-15" }]);
        expect(await periodos("Duda")).toEqual([]);
        expect(await periodos("Edu")).toEqual([{ area: "Projetos", cargo: null, inicio: "2025-05-04", fim: "2025-05-05" }]);
    });

    test("cargos de gerência e direção passam a liderar a área", async () => {
        const linhas = (await pool.query("SELECT nome, lidera_area FROM cargos")).rows;
        const mapa = Object.fromEntries(linhas.map((l) => [l.nome, l.lidera_area]));
        expect(mapa).toEqual({ "Gerente de Inovação": true, "Diretora de Projetos": true, Assessor: false });
    });

    test("as colunas e tabelas antigas saem", async () => {
        const colunas = (
            await pool.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name IN ('area_codigo', 'cargo_codigo')",
            )
        ).rowCount;
        expect(colunas).toBe(0);
        const tabelas = (
            await pool.query("SELECT 1 FROM information_schema.tables WHERE table_name IN ('historico_areas', 'historico_cargos')")
        ).rowCount;
        expect(tabelas).toBe(0);
    });

    test("o banco recusa período sobreposto na mesma área e período vazio", async () => {
        const inserir = (inicio: string, fim: string | null) =>
            pool.query("INSERT INTO periodos_area (usuario_codigo, area_codigo, inicio, fim) VALUES ($1, $2, $3, $4)", [
                pessoas.Ana,
                areas.inovacao,
                inicio,
                fim,
            ]);
        await expect(inserir("2025-06-01", null)).rejects.toMatchObject({ code: "23P01" });
        await expect(inserir("2025-06-01", "2025-06-01")).rejects.toMatchObject({ code: "23514" });
    });

    test("aplicar de novo não faz nada", async () => {
        expect(await aplicarMigracoes(pool, PASTA, silencio)).toEqual([]);
    });
});
