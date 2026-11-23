/**
 * Regras da precificação (migração 027) contra PostgreSQL de verdade.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import { REGRAS_PADRAO } from "../../source/domain/entity/RegrasPrecificacao";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;

descrever("regras da precificação contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let factory: DatabaseRepositoryFactory;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        conexao = PgConexao.criar(URL_TESTE!);
        factory = new DatabaseRepositoryFactory(conexao);
    }, 60000);

    afterAll(async () => {
        await conexao.encerrar();
        await pool.end();
    });

    test("sem linha devolve o padrão; grava, regrava e lê; só uma linha", async () => {
        const repo = factory.criarRegrasPrecificacaoRepository();
        expect(await repo.obter()).toEqual(REGRAS_PADRAO);
        await repo.salvar({ ...REGRAS_PADRAO, urgencia: 30 });
        await repo.salvar({ ...REGRAS_PADRAO, urgencia: 35.5 });
        expect((await repo.obter()).urgencia).toBe(35.5);
        expect((await pool.query("SELECT count(*)::int AS n FROM regras_precificacao")).rows[0].n).toBe(1);
        await expect(pool.query("INSERT INTO regras_precificacao (id, regras) VALUES (2, '{}')")).rejects.toThrow();
    });
});
