/**
 * Migração 016 (sessão 22): foto no lugar do avatar e saída das habilidades.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;

descrever("migração 016", () => {
    let pool: Pool;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool, PASTA, silencio);
        await pool.query("INSERT INTO usuarios (codigo, nome, email, perfil) VALUES (gen_random_uuid(), 'Ana', 'ana@x.com', 'membro')");
    }, 60000);

    afterAll(async () => {
        await pool?.end();
    });

    test("troca avatar_url por foto e apaga habilidades", async () => {
        const colunas = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios'")).rows.map(
            (l) => l.column_name,
        );
        expect(colunas).toContain("foto");
        expect(colunas).not.toContain("avatar_url");
        expect((await pool.query("SELECT to_regclass('habilidades') AS t")).rows[0].t).toBeNull();
        expect((await pool.query("SELECT to_regclass('usuario_habilidades') AS t")).rows[0].t).toBeNull();
        expect((await pool.query("SELECT 1 FROM pg_type WHERE typname = 'tipo_habilidade'")).rowCount).toBe(0);
    });

    test("foto aceita só nome de arquivo UUID.webp", async () => {
        await expect(pool.query("UPDATE usuarios SET foto = 'x.png'")).rejects.toThrow(/usuarios_foto_formato/);
        await pool.query("UPDATE usuarios SET foto = '0b6f5c8e-1a2b-4c3d-8e9f-0a1b2c3d4e5f.webp'");
    });

    test("rodar a migração de novo não falha", async () => {
        await pool.query(readFileSync(path.join(PASTA, "016_foto_sem_habilidades.sql"), "utf8"));
    });
});
