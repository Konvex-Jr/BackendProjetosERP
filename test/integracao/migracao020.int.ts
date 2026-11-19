/**
 * Migração 020 (sessão 24b) sobre um banco já na 019: responsável por item do checklist.
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

descrever("migração 020 sobre a 019", () => {
    let pool: Pool;
    let antigas: string;
    let tarefa: string;
    let pessoa: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "020")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);
        pessoa = (
            await pool.query(
                `INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash) VALUES ('Ana', 'ana@x.com', 'membro', true, 'h') RETURNING codigo`,
            )
        ).rows[0].codigo;
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
        tarefa = (
            await pool.query(
                `INSERT INTO tarefas (titulo, projeto_codigo, coluna_codigo, status, data_inicio, data_fim)
                 VALUES ('T', $1, $2, 'pendente', '2026-01-01', '2026-02-01') RETURNING codigo`,
                [projeto, coluna],
            )
        ).rows[0].codigo;
        // Item gravado antes da migração: continua existindo, sem responsável.
        await pool.query("INSERT INTO tarefa_checklist_itens (tarefa_codigo, texto) VALUES ($1, 'Antigo')", [tarefa]);
        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    test("a coluna existe e o item antigo ficou sem responsável", async () => {
        const linhas = (await pool.query("SELECT texto, responsavel_codigo FROM tarefa_checklist_itens")).rows;
        expect(linhas).toEqual([{ texto: "Antigo", responsavel_codigo: null }]);
    });

    test("grava e lê o responsável; apagar a pessoa deixa o item sem responsável", async () => {
        const codigo = (
            await pool.query(
                "INSERT INTO tarefa_checklist_itens (tarefa_codigo, texto, responsavel_codigo) VALUES ($1, 'Novo', $2) RETURNING codigo",
                [tarefa, pessoa],
            )
        ).rows[0].codigo;
        expect((await pool.query("SELECT responsavel_codigo FROM tarefa_checklist_itens WHERE codigo = $1", [codigo])).rows[0]).toEqual({
            responsavel_codigo: pessoa,
        });
        await pool.query("DELETE FROM usuarios WHERE codigo = $1", [pessoa]);
        expect((await pool.query("SELECT responsavel_codigo FROM tarefa_checklist_itens WHERE codigo = $1", [codigo])).rows[0]).toEqual({
            responsavel_codigo: null,
        });
    });

    test("rodar o SQL de novo não quebra", async () => {
        const sql = readFileSync(path.join(PASTA, "020_tarefas_e_geral.sql"), "utf8");
        await expect(pool.query(sql)).resolves.toBeDefined();
    });
});
