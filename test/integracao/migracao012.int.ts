/**
 * Migração 012 (sessão 17) sobre um banco com o esquema antigo E dados nas tabelas que saem:
 * pastas/documentos, conhecimentos, iniciativas, tarefa ligada a iniciativa e anexos dos donos antigos.
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

descrever("migração 012 sobre dados antigos", () => {
    let pool: Pool;
    let antigas: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "012")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    async function um(sql: string, params: unknown[] = []): Promise<string> {
        return (await pool.query(sql, params)).rows[0].codigo;
    }

    const tabelas = async () =>
        (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map((r) => r.tablename as string);

    test("apaga os dados antigos, troca o CHECK e mantém o resto", async () => {
        const usuario = await um("INSERT INTO usuarios (nome, email) VALUES ('Ana', 'ana@teste.com') RETURNING codigo");
        const projeto = await um(
            "INSERT INTO projetos (nome, descricao, data_inicio, data_fim) VALUES ('P', '', '2026-11-01', '2026-12-01') RETURNING codigo",
        );
        const pasta = await um("INSERT INTO pastas (nome, sigilo, projeto_codigo) VALUES ('Entregas', 'projeto', $1) RETURNING codigo", [
            projeto,
        ]);
        const documento = await um(
            `INSERT INTO documentos (nome, pasta_codigo, tamanho_bytes, data_envio, autor_codigo)
             VALUES ('Ata', $1, 10, '2026-11-01', $2) RETURNING codigo`,
            [pasta, usuario],
        );
        const conhecimento = await um(
            "INSERT INTO conhecimentos (titulo, categoria, resumo) VALUES ('Estudo', 'estudo', 'r') RETURNING codigo",
        );
        await pool.query("INSERT INTO conhecimento_projetos VALUES ($1, $2)", [conhecimento, projeto]);
        const iniciativa = await um("INSERT INTO iniciativas (titulo, tipo, frente) VALUES ('Chatbot', 'produto', 'lab') RETURNING codigo");
        await pool.query("INSERT INTO iniciativa_projetos VALUES ($1, $2)", [iniciativa, projeto]);
        await pool.query("INSERT INTO iniciativa_conhecimentos VALUES ($1, $2)", [iniciativa, conhecimento]);
        const tarefa = await um(
            `INSERT INTO tarefas (titulo, data_inicio, data_fim, prioridade, categoria, iniciativa_codigo)
             VALUES ('Pesquisar', '2026-11-01', '2026-11-05', 'P2', 'inovacao', $1) RETURNING codigo`,
            [iniciativa],
        );
        const capacitacao = await um(
            `INSERT INTO capacitacoes (titulo, data, hora, instrutor_codigo, vagas, tipo, sala)
             VALUES ('Curso', '2026-11-10', '14:00', $1, 10, 'computacao', 'Sala 1') RETURNING codigo`,
            [usuario],
        );
        const anexo = (tipo: string, dono: string) =>
            pool.query(
                `INSERT INTO anexos (codigo, dono_tipo, dono_codigo, nome, tipo_mime, tamanho_bytes, arquivo)
                 VALUES (gen_random_uuid(), $1, $2, 'a.pdf', 'application/pdf', 10, gen_random_uuid()::text)`,
                [tipo, dono],
            );
        await anexo("documento", documento);
        await anexo("conhecimento", conhecimento);
        await anexo("iniciativa", iniciativa);
        await anexo("capacitacao", capacitacao);

        expect(await aplicarMigracoes(pool, PASTA, silencio)).toEqual(["012_biblioteca.sql"]);

        const depois = await tabelas();
        for (const t of [
            "pastas",
            "documentos",
            "conhecimentos",
            "conhecimento_projetos",
            "iniciativas",
            "iniciativa_projetos",
            "iniciativa_conhecimentos",
        ]) {
            expect(depois).not.toContain(t);
        }
        expect(depois).toEqual(expect.arrayContaining(["biblioteca_itens", "anexos", "tarefas", "capacitacoes", "projetos"]));

        // A tarefa fica, sem a coluna nem o índice da iniciativa.
        expect((await pool.query("SELECT codigo FROM tarefas WHERE codigo = $1", [tarefa])).rowCount).toBe(1);
        const colunas = await pool.query(
            "SELECT 1 FROM information_schema.columns WHERE table_name = 'tarefas' AND column_name = 'iniciativa_codigo'",
        );
        expect(colunas.rowCount).toBe(0);
        expect((await pool.query("SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tarefas_iniciativa'")).rowCount).toBe(0);

        // Só sobra o anexo da capacitação; o CHECK aceita só biblioteca e capacitacao.
        const donos = (await pool.query("SELECT dono_tipo FROM anexos")).rows.map((r) => r.dono_tipo);
        expect(donos).toEqual(["capacitacao"]);
        const check = await pool.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'anexos_dono_valido'");
        expect(check.rows[0].def).toContain("'biblioteca'");
        expect(check.rows[0].def).toContain("'capacitacao'");
        expect(check.rows[0].def).not.toContain("documento");
        await expect(anexo("biblioteca", projeto)).resolves.toBeDefined();
        await expect(anexo("documento", projeto)).rejects.toThrow(/anexos_dono_valido/);
    });

    test("rodar o SQL da 012 de novo não quebra (IF EXISTS)", async () => {
        const sql = readFileSync(path.join(PASTA, "012_biblioteca.sql"), "utf8");
        await expect(pool.query(sql)).resolves.toBeDefined();
    });
});
