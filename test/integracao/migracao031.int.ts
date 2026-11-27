/**
 * Migração 031 (clientes, classe e sigilo "Só diretoria", sessão 31b) sobre um banco já na 030.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;

descrever("migração 031 sobre a 030", () => {
    let pool: Pool;
    let antigas: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "031")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);
        await pool.query("INSERT INTO areas (codigo, nome) VALUES ('00000000-0000-0000-0000-0000000000aa', 'Projetos')");
        await pool.query(`INSERT INTO projetos (codigo, nome, descricao, data_inicio, data_fim, cliente_nome, area_codigo) VALUES
            ('00000000-0000-0000-0000-000000000001', 'Com cliente', 'd', '2026-01-01', '2026-02-01', '  Padaria Sol ', '00000000-0000-0000-0000-0000000000aa'),
            ('00000000-0000-0000-0000-000000000002', 'Sem cliente', 'd', '2026-01-01', '2026-02-01', NULL, NULL),
            ('00000000-0000-0000-0000-000000000003', 'Cliente vazio', 'd', '2026-01-01', '2026-02-01', '   ', NULL)`);
        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    test("cliente_nome vira o primeiro cliente da lista e a coluna sai", async () => {
        const linhas = (await pool.query("SELECT nome, clientes, classe_codigo FROM projetos ORDER BY codigo")).rows;
        expect(linhas).toEqual([
            {
                nome: "Com cliente",
                clientes: [{ nome: "Padaria Sol", empresa: null, telefone: null, email: null }],
                classe_codigo: null,
            },
            { nome: "Sem cliente", clientes: [], classe_codigo: null },
            { nome: "Cliente vazio", clientes: [], classe_codigo: null },
        ]);
        const colunas = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'projetos'")).rows;
        expect(colunas.map((c) => c.column_name)).not.toContain("cliente_nome");
    });

    test("classes iniciais, nome único sem diferenciar maiúsculas e FK RESTRICT", async () => {
        const classes = (await pool.query("SELECT nome FROM classes_projeto ORDER BY ordem")).rows.map((l) => l.nome);
        expect(classes).toEqual(["Landing page", "Site institucional", "E-commerce", "CRM", "SaaS", "Aplicativo", "Outro"]);
        await expect(pool.query("INSERT INTO classes_projeto (codigo, nome) VALUES ('x', ' crm ')")).rejects.toThrow(
            /classes_projeto_nome_unico/,
        );
        await pool.query("UPDATE projetos SET classe_codigo = 'crm' WHERE nome = 'Com cliente'");
        await expect(pool.query("DELETE FROM classes_projeto WHERE codigo = 'crm'")).rejects.toThrow(/foreign key/);
        await expect(pool.query("UPDATE projetos SET clientes = '{}'::jsonb")).rejects.toThrow(/projetos_clientes_lista/);
    });

    test("Biblioteca aceita o sigilo diretoria", async () => {
        const restricao = (
            await pool.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'biblioteca_itens_sigilo'")
        ).rows[0].def;
        expect(restricao).toContain("diretoria");
    });

    test("rodar de novo não quebra", async () => {
        const sql = readFileSync(path.join(PASTA, "031_clientes_classe.sql"), "utf8");
        await expect(pool.query(sql)).resolves.toBeDefined();
    });
});
