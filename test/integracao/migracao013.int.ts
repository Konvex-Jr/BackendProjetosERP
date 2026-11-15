/**
 * Migração 013 (sessão 19) sobre um banco já na 012, com um anexo da Biblioteca.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;

descrever("migração 013 sobre a 012", () => {
    let pool: Pool;
    let antigas: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "013")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    const anexo = (tipo: string, dono: string) =>
        pool.query(
            `INSERT INTO anexos (codigo, dono_tipo, dono_codigo, nome, tipo_mime, tamanho_bytes, arquivo)
             VALUES (gen_random_uuid(), $1, $2, 'a.pdf', 'application/pdf', 10, gen_random_uuid()::text)`,
            [tipo, dono],
        );

    test("habilita unaccent, aceita dono tarefa e mantém os anexos antigos", async () => {
        await anexo("biblioteca", "00000000-0000-0000-0000-000000000001");

        // Só até a 013: as migrações seguintes têm teste próprio.
        const ate013 = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "014")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(ate013, arquivo));
        }
        const aplicadas = await aplicarMigracoes(pool, ate013, silencio);
        rmSync(ate013, { recursive: true, force: true });
        expect(aplicadas).toEqual(["013_anexos_tarefas_busca.sql"]);

        expect((await pool.query("SELECT unaccent('Reunião') AS t")).rows[0].t).toBe("Reuniao");
        await expect(anexo("tarefa", "00000000-0000-0000-0000-000000000002")).resolves.toBeDefined();
        await expect(anexo("documento", "00000000-0000-0000-0000-000000000003")).rejects.toThrow(/anexos_dono_valido/);

        const donos = (await pool.query("SELECT dono_tipo FROM anexos ORDER BY dono_tipo")).rows.map((r) => r.dono_tipo);
        expect(donos).toEqual(["biblioteca", "tarefa"]);
    });

    test("rodar o SQL da 013 de novo não quebra", async () => {
        const sql = readFileSync(path.join(PASTA, "013_anexos_tarefas_busca.sql"), "utf8");
        await expect(pool.query(sql)).resolves.toBeDefined();
    });
});
