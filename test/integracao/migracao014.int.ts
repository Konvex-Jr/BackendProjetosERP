/**
 * Migração 014 (sessão 20) sobre um banco já na 013, com um trainee gerente líder de um projeto.
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

descrever("migração 014 sobre a 013", () => {
    let pool: Pool;
    let antigas: string;
    let trainee: string;
    let projeto: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "014")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);

        trainee = (
            await pool.query(
                `INSERT INTO usuarios (codigo, nome, email, perfil, ativo, status)
                 VALUES (gen_random_uuid(), 'Trainee', 'trainee@teste.com', 'gerente', false, 'trainee')
                 RETURNING codigo`,
            )
        ).rows[0].codigo;
        projeto = (
            await pool.query(
                `INSERT INTO projetos (codigo, nome, descricao, data_inicio, data_fim, lider_codigo)
                 VALUES (gen_random_uuid(), 'Antigo', 'Projeto antigo', '2026-01-01', '2026-12-31', $1)
                 RETURNING codigo`,
                [trainee],
            )
        ).rows[0].codigo;
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    test("acrescenta sigilo e criador, libera o trainee como membro e tira a liderança dele", async () => {
        const ate014 = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        try {
            for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "015")) {
                copyFileSync(path.join(PASTA, arquivo), path.join(ate014, arquivo));
            }
            expect(await aplicarMigracoes(pool, ate014, silencio)).toEqual(["014_sigilo_trainee.sql"]);
        } finally {
            rmSync(ate014, { recursive: true, force: true });
        }

        const p = (await pool.query("SELECT sigiloso, criado_por_codigo, lider_codigo FROM projetos WHERE codigo = $1", [projeto])).rows[0];
        expect(p).toEqual({ sigiloso: false, criado_por_codigo: null, lider_codigo: null });

        const u = (await pool.query("SELECT perfil, ativo FROM usuarios WHERE codigo = $1", [trainee])).rows[0];
        expect(u).toEqual({ perfil: "membro", ativo: true });
    });

    test("projeto_acesso tem chave composta e some junto com o projeto", async () => {
        await pool.query("INSERT INTO projeto_acesso (projeto_codigo, usuario_codigo) VALUES ($1, $2)", [projeto, trainee]);
        await expect(
            pool.query("INSERT INTO projeto_acesso (projeto_codigo, usuario_codigo) VALUES ($1, $2)", [projeto, trainee]),
        ).rejects.toThrow(/projeto_acesso_pkey/);

        await pool.query("DELETE FROM projetos WHERE codigo = $1", [projeto]);
        expect((await pool.query("SELECT 1 FROM projeto_acesso")).rowCount).toBe(0);
    });

    // Depois do teste da tabela: aplicar todas as migrações roda a 024, que apaga a projeto_acesso (sessão 27a).

    test("rodar o SQL da 014 de novo não quebra", async () => {
        const sql = readFileSync(path.join(PASTA, "014_sigilo_trainee.sql"), "utf8");
        await expect(pool.query(sql)).resolves.toBeDefined();
    });
});
