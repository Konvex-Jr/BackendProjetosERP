/**
 * Migração 018 (sessão 23b) sobre um banco já na 017, com tarefas avulsas por categoria.
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

descrever("migração 018 sobre a 017", () => {
    let pool: Pool;
    let antigas: string;
    let areaProjetos: string;
    let projetoCliente: string;

    async function inserirArea(nome: string, pai: string | null, ativa = true): Promise<string> {
        return (
            await pool.query("INSERT INTO areas (nome, area_pai_codigo, ativa) VALUES ($1, $2, $3) RETURNING codigo", [nome, pai, ativa])
        ).rows[0].codigo;
    }

    async function inserirAvulsa(titulo: string, categoria: string, status: string, conclusao: string | null): Promise<void> {
        await pool.query(
            `INSERT INTO tarefas (titulo, categoria, status, data_inicio, data_fim, data_conclusao)
             VALUES ($1, $2, $3, '2026-01-01', '2026-02-01', $4)`,
            [titulo, categoria, status, conclusao],
        );
    }

    async function geral(area: string) {
        return (
            await pool.query(
                `SELECT p.codigo, p.nome, p.status, p.tipo, p.sigiloso, p.data_fim::text AS data_fim, pai.nome AS pai
                 FROM projetos p JOIN areas a ON a.codigo = p.area_codigo
                 LEFT JOIN areas pai ON pai.codigo = a.area_pai_codigo
                 WHERE p.geral_da_area AND a.nome = $1`,
                [area],
            )
        ).rows;
    }

    async function tarefa(titulo: string) {
        return (
            await pool.query(
                `SELECT p.nome AS projeto, c.nome AS coluna, c.papel, t.status::text AS status, to_char(t.data_conclusao, 'YYYY-MM-DD') AS conclusao
                 FROM tarefas t
                 JOIN projetos p ON p.codigo = t.projeto_codigo
                 JOIN colunas_projeto c ON c.codigo = t.coluna_codigo
                 WHERE t.titulo = $1`,
                [titulo],
            )
        ).rows[0];
    }

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "018")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);

        areaProjetos = await inserirArea("Projetos", null);
        await inserirArea("Inovação", areaProjetos);
        await inserirArea("Comercial", null, false);
        projetoCliente = (
            await pool.query(
                `INSERT INTO projetos (nome, descricao, data_inicio, data_fim) VALUES ('Site X', 'Cliente', '2026-01-01', '2026-06-01') RETURNING codigo`,
            )
        ).rows[0].codigo;
        await inserirAvulsa("Pesquisar IA", "inovacao", "pendente", null);
        await inserirAvulsa("Ajudar evento", "execucao", "andamento", null);
        await inserirAvulsa("Curso", "capacitacao", "concluida", "2026-01-20");

        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    test("cria as áreas Execução e Capacitação sob Projetos", async () => {
        const linhas = (
            await pool.query(
                `SELECT a.nome, pai.nome AS pai FROM areas a LEFT JOIN areas pai ON pai.codigo = a.area_pai_codigo
                 WHERE a.nome IN ('Execução', 'Capacitação') ORDER BY a.nome`,
            )
        ).rows;
        expect(linhas).toEqual([
            { nome: "Capacitação", pai: "Projetos" },
            { nome: "Execução", pai: "Projetos" },
        ]);
    });

    test("cada área tem um projeto geral interno com as 4 colunas padrão", async () => {
        const linhas = (
            await pool.query(
                `SELECT a.nome AS area, p.nome, p.status::text AS status, p.tipo,
                        (SELECT count(*) FROM colunas_projeto c WHERE c.projeto_codigo = p.codigo)::int AS colunas
                 FROM areas a JOIN projetos p ON p.area_codigo = a.codigo AND p.geral_da_area
                 ORDER BY a.nome`,
            )
        ).rows;
        // A 018 grava "<Área> · geral"; a 020 (aplicada junto aqui) tira a bolinha.
        expect(linhas).toEqual([
            { area: "Capacitação", nome: "Capacitação geral", status: "em_execucao", tipo: "interno", colunas: 4 },
            { area: "Comercial", nome: "Comercial geral", status: "arquivado", tipo: "interno", colunas: 4 },
            { area: "Execução", nome: "Execução geral", status: "em_execucao", tipo: "interno", colunas: 4 },
            { area: "Inovação", nome: "Inovação geral", status: "em_execucao", tipo: "interno", colunas: 4 },
            { area: "Projetos", nome: "Projetos geral", status: "em_execucao", tipo: "interno", colunas: 4 },
        ]);
        expect((await geral("Inovação"))[0].data_fim).toBe("2099-12-31");
        const descricao = (await pool.query("SELECT descricao FROM projetos WHERE nome = 'Inovação geral'")).rows[0].descricao;
        expect(descricao).toBe("Tarefas da área Inovação que ainda não são projeto.");
    });

    test("projeto de cliente continua cliente e fora do geral", async () => {
        const p = (await pool.query("SELECT tipo, geral_da_area, area_codigo FROM projetos WHERE codigo = $1", [projetoCliente])).rows[0];
        expect(p).toEqual({ tipo: "cliente", geral_da_area: false, area_codigo: null });
    });

    test("as avulsas foram para o geral da área, na coluna do status", async () => {
        expect(await tarefa("Pesquisar IA")).toMatchObject({ projeto: "Inovação geral", coluna: "A fazer", papel: "entrada" });
        expect(await tarefa("Ajudar evento")).toMatchObject({ projeto: "Execução geral", coluna: "Fazendo", papel: "meio" });
        expect(await tarefa("Curso")).toMatchObject({
            projeto: "Capacitação geral",
            papel: "concluida",
            conclusao: "2026-01-20",
        });
    });

    test("a coluna categoria saiu e projeto_codigo é obrigatório", async () => {
        const col = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'tarefas' AND column_name = 'categoria'");
        expect(col.rowCount).toBe(0);
        await expect(
            pool.query("INSERT INTO tarefas (titulo, data_inicio, data_fim) VALUES ('Sem projeto', '2026-01-01', '2026-02-01')"),
        ).rejects.toMatchObject({ code: "23502" });
    });

    test("o banco barra segundo geral, geral sigiloso e interno sem área", async () => {
        const inovacao = (await pool.query("SELECT codigo FROM areas WHERE nome = 'Inovação'")).rows[0].codigo;
        const inserir = (area: string | null, tipo: string, geralDaArea: boolean, sigiloso: boolean) =>
            pool.query(
                `INSERT INTO projetos (nome, descricao, data_inicio, data_fim, area_codigo, tipo, geral_da_area, sigiloso)
                 VALUES ('Extra', 'x', '2026-01-01', '2026-02-01', $1, $2, $3, $4)`,
                [area, tipo, geralDaArea, sigiloso],
            );
        await expect(inserir(inovacao, "interno", true, false)).rejects.toMatchObject({ code: "23505" });
        await expect(inserir(areaProjetos, "interno", true, true)).rejects.toMatchObject({ code: "23514" });
        await expect(inserir(null, "interno", false, false)).rejects.toMatchObject({ code: "23514" });
    });

    test("aplicar de novo não faz nada", async () => {
        expect(await aplicarMigracoes(pool, PASTA, silencio)).toEqual([]);
    });
});
