/**
 * Migração 029 (dificuldade em % do dia, 25/11) sobre um banco já na 028.
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

descrever("migração 029 sobre a 028", () => {
    let pool: Pool;
    let antigas: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "029")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);
        // Horas já alteradas pela diretoria: a 029 troca todas pelo padrão em %.
        await pool.query(`UPDATE horas_dificuldade SET horas = CASE dificuldade
            WHEN 'rapida' THEN 0.5 WHEN 'facil' THEN 3 WHEN 'media' THEN 6 ELSE 12 END`);
        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    test("coluna horas vira percentual (SMALLINT) com 25/50/75/100", async () => {
        const colunas = (
            await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'horas_dificuldade'")
        ).rows;
        expect(colunas.map((c) => c.column_name)).not.toContain("horas");
        expect(colunas).toContainEqual({ column_name: "percentual", data_type: "smallint" });
        const linhas = (await pool.query("SELECT dificuldade, percentual FROM horas_dificuldade ORDER BY percentual")).rows;
        expect(linhas).toEqual([
            { dificuldade: "rapida", percentual: 25 },
            { dificuldade: "facil", percentual: 50 },
            { dificuldade: "media", percentual: 75 },
            { dificuldade: "dificil", percentual: 100 },
        ]);
    });

    test("CHECK aceita 5 a 100 e recusa 4 e 101", async () => {
        const gravar = (valor: number) => pool.query("UPDATE horas_dificuldade SET percentual = $1 WHERE dificuldade = 'media'", [valor]);
        await expect(gravar(101)).rejects.toThrow(/horas_dificuldade_percentual_check/);
        await expect(gravar(4)).rejects.toThrow(/horas_dificuldade_percentual_check/);
        await expect(gravar(5)).resolves.toBeDefined();
        await expect(gravar(100)).resolves.toBeDefined();
    });

    test("rodar a 029 de novo não quebra nem muda os valores", async () => {
        await pool.query("UPDATE horas_dificuldade SET percentual = 60 WHERE dificuldade = 'media'");
        const { readFileSync } = await import("fs");
        await pool.query(readFileSync(path.join(PASTA, "029_dificuldade_percentual.sql"), "utf8"));
        const media = (await pool.query("SELECT percentual FROM horas_dificuldade WHERE dificuldade = 'media'")).rows[0];
        expect(media.percentual).toBe(60);
    });
});
