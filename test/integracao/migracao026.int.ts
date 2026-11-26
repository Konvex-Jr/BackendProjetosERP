/**
 * Migração 026 (sessão 28b): reuniões e participantes.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { readFileSync } from "fs";
import path from "path";
import Reuniao from "../../source/domain/entity/Reuniao";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import ReuniaoRepositoryDatabase from "../../source/infra/repository/database/ReuniaoRepositoryDatabase";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;
const d = (texto: string) => new Date(`${texto}T00:00:00.000Z`);

descrever("migração 026 (reuniões)", () => {
    let pool: Pool;
    let repo: ReuniaoRepositoryDatabase;
    let ana: string;
    let bia: string;
    let caio: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool, PASTA, silencio);
        // Rodar de novo não quebra.
        await pool.query(readFileSync(path.join(PASTA, "026_reunioes.sql"), "utf8"));
        const pessoa = async (nome: string) =>
            (
                await pool.query(`INSERT INTO usuarios (nome, email, ativo, senha_hash) VALUES ($1, $2, true, 'h') RETURNING codigo`, [
                    nome,
                    `${nome}@x.com`,
                ])
            ).rows[0].codigo as string;
        ana = await pessoa("ana");
        bia = await pessoa("bia");
        caio = await pessoa("caio");
        repo = new ReuniaoRepositoryDatabase(new PgConexao(pool));
    }, 60000);

    afterAll(async () => {
        await pool?.end();
    });

    const nova = (titulo: string, data: string, participantes: string[]) =>
        new Reuniao({
            titulo,
            data: d(data),
            hora: "14:30",
            duracaoMinutos: 45,
            local: "Sala 2",
            criadoPor: { codigo: ana, nome: "ana" },
            participantes: participantes.map((codigo) => ({ codigo, nome: "", email: "" })),
        });

    test("grava, lista por pessoa e período, troca participantes e exclui", async () => {
        const r = await repo.criar(nova("Alinhamento", "2026-11-24", [ana, bia]));
        expect(r).toMatchObject({ titulo: "Alinhamento", hora: "14:30", duracaoMinutos: 45, local: "Sala 2" });
        expect(r.data.toISOString().slice(0, 10)).toBe("2026-11-24");
        expect(r.participantes.map((p) => p.email).sort()).toEqual(["ana@x.com", "bia@x.com"]);
        await repo.criar(nova("Dezembro", "2026-12-02", [ana]));

        expect((await repo.listarDaPessoa(bia, d("2026-11-01"), d("2026-11-30"))).map((x) => x.titulo)).toEqual(["Alinhamento"]);
        expect(await repo.listarDaPessoa(caio, d("2026-11-01"), d("2026-12-31"))).toEqual([]);
        expect((await repo.listarDaPessoa(ana, d("2026-11-24"), d("2026-12-02"))).map((x) => x.titulo)).toEqual([
            "Alinhamento",
            "Dezembro",
        ]);

        const editada = await repo.editar(
            r.com({
                hora: "09:00",
                participantes: [
                    { codigo: ana, nome: "", email: "" },
                    { codigo: caio, nome: "", email: "" },
                ],
            }),
        );
        expect(editada.hora).toBe("09:00");
        expect(editada.participantes.map((p) => p.codigo).sort()).toEqual([ana, caio].sort());
        expect(await repo.listarDaPessoa(bia, d("2026-11-01"), d("2026-11-30"))).toEqual([]);

        expect(await repo.buscarPorCodigo("nao-e-uuid")).toBeNull();
        await repo.excluir(r.codigo);
        expect(await repo.buscarPorCodigo(r.codigo)).toBeNull();
        expect(
            (await pool.query("SELECT count(*)::int AS n FROM reuniao_participantes WHERE reuniao_codigo = $1", [r.codigo])).rows[0].n,
        ).toBe(0);
    });

    test("CHECKs: título vazio e duração fora de 5 a 720", async () => {
        await expect(
            pool.query(
                `INSERT INTO reunioes (titulo, data, hora, duracao_minutos, criado_por) VALUES (' ', '2026-01-01', '10:00', 30, $1)`,
                [ana],
            ),
        ).rejects.toThrow();
        await expect(
            pool.query(
                `INSERT INTO reunioes (titulo, data, hora, duracao_minutos, criado_por) VALUES ('x', '2026-01-01', '10:00', 721, $1)`,
                [ana],
            ),
        ).rejects.toThrow();
    });
});
