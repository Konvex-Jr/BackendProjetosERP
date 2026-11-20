/**
 * Migração 021 (sessão 25a) sobre um banco já na 020: tabela links_senha e refresh_tokens.lembrar.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import LinkSenhaRepositoryDatabase from "../../source/infra/repository/database/LinkSenhaRepositoryDatabase";
import PgConexao from "../../source/infra/database/PgConexao";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;

descrever("migração 021 sobre a 020", () => {
    let pool: Pool;
    let antigas: string;
    let pessoa: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "021")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);
        pessoa = (
            await pool.query(
                `INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash) VALUES ('Ana', 'ana@x.com', 'membro', true, 'h') RETURNING codigo`,
            )
        ).rows[0].codigo;
        await pool.query(
            `INSERT INTO refresh_tokens (usuario_codigo, token_hash, expira_em) VALUES ($1, 'antigo', now() + interval '1 day')`,
            [pessoa],
        );
        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    test("refresh token antigo ficou com lembrar false", async () => {
        expect((await pool.query("SELECT lembrar FROM refresh_tokens WHERE token_hash = 'antigo'")).rows).toEqual([{ lembrar: false }]);
    });

    test("repositório grava, busca, invalida e marca uso único", async () => {
        const repo = new LinkSenhaRepositoryDatabase(new PgConexao(pool));
        const base = { codigoUsuario: pessoa, expiraEm: new Date(Date.now() + 60000), usadoEm: null };
        const hash = (c: string) => c.repeat(64);
        await repo.criar({ ...base, codigo: "00000000-0000-4000-8000-000000000001", tipo: "convite", tokenHash: hash("a") });
        await repo.criar({ ...base, codigo: "00000000-0000-4000-8000-000000000002", tipo: "redefinir", tokenHash: hash("b") });
        expect((await repo.buscarPorHash(hash("a")))?.tipo).toBe("convite");
        expect(await repo.buscarPorHash(hash("z"))).toBeNull();
        await repo.invalidarDoUsuario(pessoa, "convite");
        expect((await repo.buscarPorHash(hash("a")))?.usadoEm).not.toBeNull();
        expect((await repo.buscarPorHash(hash("b")))?.usadoEm).toBeNull();
        expect(await repo.marcarUsado("00000000-0000-4000-8000-000000000002")).toBe(true);
        expect(await repo.marcarUsado("00000000-0000-4000-8000-000000000002")).toBe(false);
    });

    test("tipo inválido é recusado e apagar a pessoa apaga os links", async () => {
        await expect(
            pool.query(`INSERT INTO links_senha (usuario_codigo, tipo, token_hash, expira_em) VALUES ($1, 'x', $2, now())`, [
                pessoa,
                "c".repeat(64),
            ]),
        ).rejects.toThrow();
        await pool.query("DELETE FROM usuarios WHERE codigo = $1", [pessoa]);
        expect((await pool.query("SELECT count(*)::int AS n FROM links_senha")).rows[0].n).toBe(0);
    });

    test("rodar o SQL de novo não quebra", async () => {
        await expect(pool.query(readFileSync(path.join(PASTA, "021_conta_senha.sql"), "utf8"))).resolves.toBeDefined();
    });
});
