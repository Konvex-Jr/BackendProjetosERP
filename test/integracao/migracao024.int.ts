/**
 * Migração 024 (sessão 27a): sai a lista de acesso dos projetos sigilosos.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;

descrever("migração 024 (visibilidade de projetos)", () => {
    let pool: Pool;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        await pool?.end();
    });

    test("a tabela projeto_acesso deixa de existir", async () => {
        expect((await pool.query("SELECT to_regclass('projeto_acesso') AS t")).rows[0].t).toBeNull();
    });

    test("rodar de novo não falha (executor e o próprio arquivo)", async () => {
        await expect(aplicarMigracoes(pool, PASTA, silencio)).resolves.not.toThrow();
        const sql = fs.readFileSync(path.join(PASTA, "024_visibilidade_projetos.sql"), "utf8");
        await expect(pool.query(sql)).resolves.toBeDefined();
        expect((await pool.query("SELECT to_regclass('projeto_acesso') AS t")).rows[0].t).toBeNull();
    });
});
