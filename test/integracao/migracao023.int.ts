/**
 * Migração 023 (sessão 26a): tabela de avisos.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import path from "path";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import AvisoRepositoryDatabase from "../../source/infra/repository/database/AvisoRepositoryDatabase";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;

descrever("migração 023 (avisos)", () => {
    let pool: Pool;
    let ana: string;
    let bia: string;
    let projeto: string;
    let coluna: string;

    const novaTarefa = async () =>
        (
            await pool.query(
                `INSERT INTO tarefas (titulo, projeto_codigo, coluna_codigo, status, data_inicio, data_fim)
                 VALUES ('T', $1, $2, 'pendente', '2026-01-01', '2026-02-01') RETURNING codigo`,
                [projeto, coluna],
            )
        ).rows[0].codigo as string;
    const aviso = (usuario: string, tarefa: string | null, autor: string | null = null, tipo = "tarefa_recebida") =>
        pool.query("INSERT INTO avisos (usuario_codigo, tipo, tarefa_codigo, autor_codigo) VALUES ($1, $2, $3, $4)", [
            usuario,
            tipo,
            tarefa,
            autor,
        ]);

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool, PASTA, silencio);
        const pessoa = async (nome: string) =>
            (
                await pool.query(
                    `INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash) VALUES ($1, $2, 'membro', true, 'h') RETURNING codigo`,
                    [nome, `${nome}@x.com`],
                )
            ).rows[0].codigo as string;
        ana = await pessoa("ana");
        bia = await pessoa("bia");
        projeto = (
            await pool.query(
                `INSERT INTO projetos (nome, descricao, data_inicio, data_fim) VALUES ('P', 'D', '2026-01-01', '2026-06-01') RETURNING codigo`,
            )
        ).rows[0].codigo;
        coluna = (
            await pool.query(
                "INSERT INTO colunas_projeto (projeto_codigo, nome, papel, ordem, cor) VALUES ($1, 'A fazer', 'entrada', 1, 'cinza') RETURNING codigo",
                [projeto],
            )
        ).rows[0].codigo;
    }, 60000);

    afterAll(async () => {
        await pool?.end();
    });

    beforeEach(async () => {
        await pool.query("DELETE FROM avisos");
    });

    test("apagar a tarefa apaga o aviso", async () => {
        const t = await novaTarefa();
        await aviso(ana, t);
        await pool.query("DELETE FROM tarefas WHERE codigo = $1", [t]);
        expect((await pool.query("SELECT count(*)::int AS n FROM avisos")).rows[0].n).toBe(0);
    });

    test("apagar o autor deixa autor_codigo nulo", async () => {
        const autor = (
            await pool.query(
                `INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash) VALUES ('c', 'c@x.com', 'membro', true, 'h') RETURNING codigo`,
            )
        ).rows[0].codigo;
        await aviso(ana, await novaTarefa(), autor);
        await pool.query("DELETE FROM usuarios WHERE codigo = $1", [autor]);
        expect((await pool.query("SELECT autor_codigo FROM avisos")).rows).toEqual([{ autor_codigo: null }]);
    });

    test("tipo fora da lista falha no CHECK", async () => {
        await expect(aviso(ana, null, null, "outro")).rejects.toThrow(/check/i);
    });

    test("segundo tarefa_recebida não lido da mesma pessoa e tarefa viola o índice; depois de lido, entra", async () => {
        const t = await novaTarefa();
        await aviso(ana, t);
        await expect(aviso(ana, t)).rejects.toThrow(/avisos_tarefa_nao_lida/);
        await aviso(bia, t);
        await pool.query("UPDATE avisos SET lido_em = now() WHERE usuario_codigo = $1", [ana]);
        await aviso(ana, t);
        expect((await pool.query("SELECT count(*)::int AS n FROM avisos WHERE usuario_codigo = $1", [ana])).rows[0].n).toBe(2);
    });

    test("repositório: duplicata ignorada e código malformado não vira erro", async () => {
        const repo = new AvisoRepositoryDatabase(new PgConexao(pool));
        const t = await novaTarefa();
        const novo = { codigoUsuario: ana, tipo: "tarefa_recebida" as const, codigoTarefa: t, codigoCapacitacao: null, codigoAutor: null };
        await repo.criarVarios([novo, novo]);
        const lista = await repo.listarDoUsuario(ana);
        expect(lista).toHaveLength(1);
        await repo.marcarLidos(ana, ["lixo"]);
        await repo.marcarLidos(bia, [lista[0].codigo]);
        expect((await repo.listarDoUsuario(ana))[0].lidoEm).toBeNull();
        await repo.marcarLidos(ana, [lista[0].codigo]);
        expect((await repo.listarDoUsuario(ana))[0].lidoEm).not.toBeNull();
        await repo.apagarLidosAntes(ana, new Date(Date.now() + 60000));
        expect(await repo.listarDoUsuario(ana)).toHaveLength(0);
    });
});
