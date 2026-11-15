/**
 * Integração dos anexos (contagem por dono) contra PostgreSQL de verdade.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import Anexo from "../../source/domain/entity/Anexo";
import { DonoAnexo } from "../../source/domain/enum/Anexo";
import AnexoRepositoryInterface from "../../source/domain/interfaces/AnexoRepositoryInterface";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;

descrever("anexos contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let repo: AnexoRepositoryInterface;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        conexao = PgConexao.criar(URL_TESTE!);
        repo = new DatabaseRepositoryFactory(conexao).criarAnexoRepository();
    }, 60000);

    afterEach(async () => {
        await pool.query("DELETE FROM anexos");
    });

    afterAll(async () => {
        await conexao?.encerrar();
        await pool?.end();
    });

    const anexar = (donoCodigo: string, nome: string, donoTipo = DonoAnexo.TAREFA) =>
        repo.criar(new Anexo({ donoTipo, donoCodigo, nome, tamanhoBytes: 10, enviadoPor: null }));

    test("contarPorDonos conta por dono (2, 1 e 0) e só do tipo pedido", async () => {
        const [d1, d2, d3] = [1, 2, 3].map(() => crypto.randomUUID());
        await anexar(d1, "a.pdf");
        await anexar(d1, "b.pdf");
        await anexar(d2, "c.pdf");
        await anexar(d3, "outro-tipo.pdf", DonoAnexo.BIBLIOTECA);

        const mapa = await repo.contarPorDonos(DonoAnexo.TAREFA, [d1, d2, d3]);

        expect(mapa.get(d1)).toBe(2);
        expect(mapa.get(d2)).toBe(1);
        expect(mapa.get(d3) ?? 0).toBe(0);
    });

    test("contarPorDonos com lista vazia devolve mapa vazio", async () => {
        expect((await repo.contarPorDonos(DonoAnexo.TAREFA, [])).size).toBe(0);
    });
});
