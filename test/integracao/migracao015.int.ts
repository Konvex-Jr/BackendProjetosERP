/**
 * Migração 015 (sessão 21) sobre um banco já na 014, com tarefas de projeto em vários status.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import Projeto from "../../source/domain/entity/Projeto";
import ColunaProjeto from "../../source/domain/entity/ColunaProjeto";
import { PapelColuna } from "../../source/domain/enum/ColunaProjeto";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;
const HOJE = new Date("2026-11-16T00:00:00.000Z");

descrever("migração 015 sobre a 014", () => {
    let pool: Pool;
    let antigas: string;
    let projetoA: string;
    let projetoB: string;
    let antes: Map<string, unknown>;
    const tarefas: Record<string, string> = {};

    async function inserirProjeto(nome: string): Promise<string> {
        return (
            await pool.query(
                `INSERT INTO projetos (codigo, nome, descricao, data_inicio, data_fim)
                 VALUES (gen_random_uuid(), $1, 'Projeto', '2026-01-01', '2026-12-31')
                 RETURNING codigo`,
                [nome],
            )
        ).rows[0].codigo;
    }

    async function inserirTarefa(chave: string, projeto: string | null, status: string, conclusao: string | null): Promise<void> {
        tarefas[chave] = (
            await pool.query(
                `INSERT INTO tarefas (codigo, projeto_codigo, titulo, data_inicio, data_fim, status, data_conclusao, categoria)
                 VALUES (gen_random_uuid(), $1, $2, '2026-02-01', '2026-03-01', $3, $4, $5)
                 RETURNING codigo`,
                [projeto, chave, status, conclusao, projeto ? null : "inovacao"],
            )
        ).rows[0].codigo;
    }

    async function contagens() {
        const conexao = PgConexao.criar(URL_TESTE!);
        try {
            const mapa = await new DatabaseRepositoryFactory(conexao).criarTarefaRepository().contarPorProjetos([projetoA, projetoB], HOJE);
            return JSON.stringify([...mapa.entries()]);
        } finally {
            await conexao.encerrar();
        }
    }

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "015")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);

        projetoA = await inserirProjeto("Primeiro");
        projetoB = await inserirProjeto("Segundo");
        await inserirTarefa("pendente", projetoA, "pendente", null);
        await inserirTarefa("andamento", projetoA, "andamento", null);
        await inserirTarefa("concluida", projetoA, "concluida", "2026-02-20");
        await inserirTarefa("concluidaSemData", projetoA, "concluida", null);
        await inserirTarefa("pendenteComData", projetoA, "pendente", "2026-02-10");
        await inserirTarefa("avulsa", null, "pendente", null);
        antes = new Map([["contagens", await contagens()]]);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    test("cria as quatro colunas padrão em cada projeto, também ao rodar de novo", async () => {
        // Só até a 015: as seguintes (a 018 apaga a categoria das tarefas) mudam o que este teste confere.
        copyFileSync(path.join(PASTA, "015_colunas_projeto.sql"), path.join(antigas, "015_colunas_projeto.sql"));
        expect(await aplicarMigracoes(pool, antigas, silencio)).toEqual(["015_colunas_projeto.sql"]);
        await pool.query(readFileSync(path.join(PASTA, "015_colunas_projeto.sql"), "utf8"));

        for (const projeto of [projetoA, projetoB]) {
            const colunas = (
                await pool.query("SELECT nome, cor, papel, ordem FROM colunas_projeto WHERE projeto_codigo = $1 ORDER BY ordem", [projeto])
            ).rows;
            expect(colunas).toEqual([
                { nome: "A fazer", cor: "cinza", papel: "entrada", ordem: 0 },
                { nome: "Fazendo", cor: "azul", papel: "meio", ordem: 1 },
                { nome: "Revisando", cor: "amarelo", papel: "meio", ordem: 2 },
                { nome: "Concluído", cor: "verde", papel: "concluida", ordem: 3 },
            ]);
        }
    });

    test("cada tarefa vai para a coluna do status e a avulsa fica sem coluna", async () => {
        const linhas = (
            await pool.query(
                `SELECT t.titulo, t.coluna_codigo, c.nome AS coluna
                 FROM tarefas t LEFT JOIN colunas_projeto c ON c.codigo = t.coluna_codigo`,
            )
        ).rows;
        const porTitulo = Object.fromEntries(linhas.map((l) => [l.titulo, l]));
        expect(porTitulo.pendente.coluna).toBe("A fazer");
        expect(porTitulo.andamento.coluna).toBe("Fazendo");
        expect(porTitulo.concluida.coluna).toBe("Concluído");
        expect(porTitulo.concluidaSemData.coluna).toBe("Concluído");
        expect(porTitulo.pendenteComData.coluna).toBe("A fazer");
        expect(porTitulo.avulsa.coluna_codigo).toBeNull();
    });

    test("acerta a conclusão e mantém as contagens por projeto", async () => {
        const dados = async (chave: string) =>
            (await pool.query("SELECT to_char(data_conclusao, 'YYYY-MM-DD') AS conclusao FROM tarefas WHERE codigo = $1", [tarefas[chave]]))
                .rows[0].conclusao;
        expect(await dados("concluidaSemData")).toBe("2026-03-01");
        expect(await dados("concluida")).toBe("2026-02-20");
        expect(await dados("pendenteComData")).toBeNull();
        expect(await contagens()).toBe(antes.get("contagens"));
    });

    test("o banco recusa tarefa sem coluna, com coluna de outro projeto, entrada repetida, nome repetido e nome vazio", async () => {
        const inserir = (projeto: string, coluna: string | null) =>
            pool.query(
                `INSERT INTO tarefas (codigo, projeto_codigo, coluna_codigo, titulo, data_inicio, data_fim, status)
                 VALUES (gen_random_uuid(), $1, $2, 'Nova', '2026-02-01', '2026-03-01', 'pendente')`,
                [projeto, coluna],
            );
        const colunaB = (await pool.query("SELECT codigo FROM colunas_projeto WHERE projeto_codigo = $1 AND papel = 'entrada'", [projetoB]))
            .rows[0].codigo;

        await expect(inserir(projetoA, null)).rejects.toThrow(/tarefas_coluna_com_projeto/);
        await expect(inserir(projetoA, colunaB)).rejects.toThrow(/tarefas_coluna_do_projeto_fk/);
        await expect(
            pool.query("INSERT INTO colunas_projeto (projeto_codigo, nome, cor, ordem, papel) VALUES ($1, 'Outra', 'rosa', 9, 'entrada')", [
                projetoA,
            ]),
        ).rejects.toThrow(/idx_colunas_projeto_entrada/);
        await expect(
            pool.query("INSERT INTO colunas_projeto (projeto_codigo, nome, cor, ordem, papel) VALUES ($1, 'FAZENDO', 'rosa', 9, 'meio')", [
                projetoA,
            ]),
        ).rejects.toThrow(/idx_colunas_projeto_nome/);
        await expect(
            pool.query("INSERT INTO colunas_projeto (projeto_codigo, nome, cor, ordem, papel) VALUES ($1, '   ', 'rosa', 9, 'meio')", [
                projetoA,
            ]),
        ).rejects.toThrow(/colunas_projeto_nome_preenchido/);
    });

    test("o repositório grava as colunas ao criar o projeto e a tarefa fica na coluna dele", async () => {
        const conexao = PgConexao.criar(URL_TESTE!);
        try {
            const fabrica = new DatabaseRepositoryFactory(conexao);
            const colunas = [
                new ColunaProjeto("Backlog", "roxo", PapelColuna.ENTRADA),
                new ColunaProjeto("Feito", "verde", PapelColuna.CONCLUIDA),
            ];
            const projeto = new Projeto("Novo", "Descrição", new Date("2026-01-01"), new Date("2026-12-31"), undefined, [], undefined, {
                colunas,
            });
            await fabrica.criarProjetoRepository().criar(projeto);
            const lido = (await fabrica.criarProjetoRepository().buscarPorCodigo(projeto.codigo))!;
            expect(lido.colunas.map((c) => [c.nome, c.cor, c.papel])).toEqual([
                ["Backlog", "roxo", "entrada"],
                ["Feito", "verde", "concluida"],
            ]);

            // Editar o projeto não mexe nas colunas.
            await fabrica.criarProjetoRepository().editar(lido.copiar({ nome: "Novo 2", colunas: colunasPadraoFalsas() }));
            expect((await fabrica.criarProjetoRepository().buscarPorCodigo(projeto.codigo))!.colunas.map((c) => c.nome)).toEqual([
                "Backlog",
                "Feito",
            ]);
        } finally {
            await conexao.encerrar();
        }
    });

    test("excluir o projeto leva tarefas e colunas junto", async () => {
        await pool.query("DELETE FROM projetos WHERE codigo = $1", [projetoB]);
        await pool.query("DELETE FROM projetos WHERE codigo = $1", [projetoA]);
        expect((await pool.query("SELECT 1 FROM colunas_projeto WHERE projeto_codigo IN ($1, $2)", [projetoA, projetoB])).rowCount).toBe(0);
        expect((await pool.query("SELECT 1 FROM tarefas WHERE projeto_codigo IN ($1, $2)", [projetoA, projetoB])).rowCount).toBe(0);
    });

    test("ler tarefa com dados antigos incoerentes devolve a coluna, sem lançar", async () => {
        // O domínio não lê mais tarefa sem projeto (avulsa, fim na 018): a avulsa antiga sai antes da leitura.
        await pool.query("DELETE FROM tarefas WHERE projeto_codigo IS NULL");
        const projeto = await inserirProjeto("Terceiro");
        const colunas = (
            await pool.query(
                "INSERT INTO colunas_projeto (projeto_codigo, nome, cor, ordem, papel) VALUES ($1, 'A', 'cinza', 0, 'entrada'), ($1, 'B', 'verde', 1, 'concluida') RETURNING codigo, papel",
                [projeto],
            )
        ).rows;
        const concluida = colunas.find((c) => c.papel === "concluida").codigo;
        await pool.query(
            `INSERT INTO tarefas (codigo, projeto_codigo, coluna_codigo, titulo, data_inicio, data_fim, status, data_conclusao)
             VALUES (gen_random_uuid(), $1, $2, 'Velha', '2026-02-01', '2026-03-01', 'concluida', '2026-02-20')`,
            [projeto, concluida],
        );
        // Derruba o check só durante este teste e devolve no fim (com a tarefa velha já fora), para não vazar para o banco.
        await pool.query("ALTER TABLE tarefas DROP CONSTRAINT tarefas_conclusao_coerente");
        const conexao = PgConexao.criar(URL_TESTE!);
        try {
            await pool.query("UPDATE tarefas SET status = 'pendente', data_conclusao = NULL WHERE titulo = 'Velha'");
            const lidas = await new DatabaseRepositoryFactory(conexao).criarTarefaRepository().listar();
            const velha = lidas.find((t) => t.titulo === "Velha")!;
            expect(velha.status).toBe("concluida");
            expect(velha.coluna?.nome).toBe("B");
        } finally {
            await conexao.encerrar();
            await pool.query("DELETE FROM tarefas WHERE titulo = 'Velha'");
            await pool.query(
                "ALTER TABLE tarefas ADD CONSTRAINT tarefas_conclusao_coerente CHECK ((status = 'concluida') = (data_conclusao IS NOT NULL))",
            );
        }
    });
});

function colunasPadraoFalsas(): ColunaProjeto[] {
    return [new ColunaProjeto("Outra", "rosa", PapelColuna.ENTRADA), new ColunaProjeto("Fim", "verde", PapelColuna.CONCLUIDA)];
}
