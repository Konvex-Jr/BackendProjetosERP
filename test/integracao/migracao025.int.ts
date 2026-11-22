/**
 * Migração 025 (sessão 27b): sai o responsável do projeto; quem era responsável vira líder se o projeto
 * não tinha líder, a pessoa está na equipe atual e não é trainee.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;

descrever("migração 025 (só o líder)", () => {
    let pool: Pool;
    let antigas: string;
    const p: Record<string, string> = {};

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "025")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);
        const pessoa = async (nome: string, status: string) =>
            (
                await pool.query(
                    `INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash, status)
                     VALUES ($1, $2, 'membro', true, 'h', $3) RETURNING codigo`,
                    [nome, `${nome}@x.com`, status],
                )
            ).rows[0].codigo as string;
        const ana = await pessoa("ana", "ativo");
        const tito = await pessoa("tito", "trainee");
        const bia = await pessoa("bia", "ativo");
        const projeto = async (nome: string, responsavel: string | null, lider: string | null, equipe: { u: string; saiu?: boolean }[]) => {
            const codigo = (
                await pool.query(
                    `INSERT INTO projetos (nome, descricao, data_inicio, data_fim, responsavel_codigo, lider_codigo)
                     VALUES ($1, 'd', '2026-01-01', '2026-06-01', $2, $3) RETURNING codigo`,
                    [nome, responsavel, lider],
                )
            ).rows[0].codigo as string;
            for (const m of equipe) {
                await pool.query(
                    `INSERT INTO projeto_membros (projeto_codigo, usuario_codigo, data_entrada, data_saida) VALUES ($1, $2, '2026-01-01', $3)`,
                    [codigo, m.u, m.saiu ? "2026-02-01" : null],
                );
            }
            p[nome] = codigo;
            p[`lider-${nome}`] = lider ?? "";
            p.ana = ana;
            p.bia = bia;
        };
        await projeto("vira", ana, null, [{ u: ana }]);
        await projeto("trainee", tito, null, [{ u: tito }]);
        await projeto("fora", ana, null, [{ u: ana, saiu: true }]);
        await projeto("temLider", ana, bia, [{ u: ana }, { u: bia }]);
        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        await pool?.end();
        if (antigas) rmSync(antigas, { recursive: true, force: true });
    });

    const lider = async (nome: string) =>
        (await pool.query("SELECT lider_codigo FROM projetos WHERE codigo = $1", [p[nome]])).rows[0].lider_codigo;

    test("responsável na equipe atual, ativo, vira líder", async () => {
        expect(await lider("vira")).toBe(p.ana);
    });

    test("trainee e ex-membro não viram líder; líder existente fica", async () => {
        expect(await lider("trainee")).toBeNull();
        expect(await lider("fora")).toBeNull();
        expect(await lider("temLider")).toBe(p.bia);
    });

    test("a coluna responsavel_codigo sai e rodar de novo não falha", async () => {
        const col = await pool.query(
            "SELECT 1 FROM information_schema.columns WHERE table_name = 'projetos' AND column_name = 'responsavel_codigo'",
        );
        expect(col.rowCount).toBe(0);
        await expect(pool.query(readFileSync(path.join(PASTA, "025_so_lider.sql"), "utf8"))).resolves.toBeDefined();
    });
});
