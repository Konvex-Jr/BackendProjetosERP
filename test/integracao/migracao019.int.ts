/**
 * Migração 019 (sessão 24a) sobre um banco já na 018.
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

descrever("migração 019 sobre a 018", () => {
    let pool: Pool;
    let antigas: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "019")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);
        await pool.query("INSERT INTO cargos (nome) VALUES ('Diretor de Projetos'), ('Assessor')");
        const pessoa = (
            await pool.query(
                `INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash) VALUES ('Ana', 'ana@x.com', 'membro', true, 'h') RETURNING codigo`,
            )
        ).rows[0].codigo;
        const proj = (
            await pool.query(
                `INSERT INTO projetos (nome, descricao, data_inicio, data_fim) VALUES ('Antigo', 'D', '2026-01-01', '2026-06-01') RETURNING codigo`,
            )
        ).rows[0].codigo;
        await pool.query(
            `INSERT INTO projeto_membros (projeto_codigo, usuario_codigo, alocacao, data_entrada) VALUES ($1, $2, 30, '2026-01-01')`,
            [proj, pessoa],
        );
        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    test("tarefas.dificuldade aceita media e recusa muito_dificil", async () => {
        const projeto = (
            await pool.query(
                `INSERT INTO projetos (nome, descricao, data_inicio, data_fim) VALUES ('P', 'D', '2026-01-01', '2026-06-01') RETURNING codigo`,
            )
        ).rows[0].codigo;
        const coluna = (
            await pool.query(
                "INSERT INTO colunas_projeto (projeto_codigo, nome, papel, ordem, cor) VALUES ($1, 'A fazer', 'entrada', 1, 'cinza') RETURNING codigo",
                [projeto],
            )
        ).rows[0].codigo;
        const inserir = (dificuldade: string) =>
            pool.query(
                `INSERT INTO tarefas (titulo, projeto_codigo, coluna_codigo, status, data_inicio, data_fim, dificuldade)
                 VALUES ('T', $1, $2, 'pendente', '2026-01-01', '2026-02-01', $3)`,
                [projeto, coluna, dificuldade],
            );
        await expect(inserir("media")).resolves.toBeDefined();
        await expect(inserir("muito_dificil")).rejects.toThrow();
        await expect(inserir("extrema")).rejects.toThrow(/tarefas_dificuldade_valida/);
    });

    test("projeto_membros perde a coluna alocacao e mantém a participação", async () => {
        const colunas = (
            await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'projeto_membros'")
        ).rows.map((r) => r.column_name);
        expect(colunas).not.toContain("alocacao");
        expect((await pool.query("SELECT 1 FROM projeto_membros")).rowCount).toBe(1);
    });

    test("horas_dificuldade tem os 4 valores", async () => {
        const linhas = (await pool.query("SELECT dificuldade, horas::float AS horas FROM horas_dificuldade ORDER BY horas")).rows;
        expect(linhas).toEqual([
            { dificuldade: "rapida", horas: 1 },
            { dificuldade: "facil", horas: 2 },
            { dificuldade: "media", horas: 4 },
            { dificuldade: "dificil", horas: 8 },
        ]);
    });

    test("teto semanal: 20 para Diretor, 10 para Assessor", async () => {
        const linhas = (
            await pool.query("SELECT nome, teto_semanal_horas FROM cargos WHERE nome IN ('Diretor de Projetos', 'Assessor') ORDER BY nome")
        ).rows;
        expect(linhas).toEqual([
            { nome: "Assessor", teto_semanal_horas: 10 },
            { nome: "Diretor de Projetos", teto_semanal_horas: 20 },
        ]);
    });
});
