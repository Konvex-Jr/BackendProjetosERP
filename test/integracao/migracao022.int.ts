/**
 * Migração 022 (sessão 25b) sobre um banco já na 021: e-mail pessoal, motivo da saída, fim do trainee,
 * cursos fixos e fim do status Alumni.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import UsuarioRepositoryDatabase from "../../source/infra/repository/database/UsuarioRepositoryDatabase";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;

descrever("migração 022 sobre a 021", () => {
    let pool: Pool;
    let antigas: string;

    async function inserir(nome: string, status: string, curso: string | null, dataSaida: string | null = null) {
        await pool.query(
            `INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash, status, curso, data_saida)
             VALUES ($1, $2, 'diretor', true, 'h', $3, $4, $5)`,
            [nome, `${nome.toLowerCase().replace(/\W/g, "")}@x.com`, status, curso, dataSaida],
        );
    }

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "022")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
        await aplicarMigracoes(pool, antigas, silencio);
        await inserir("Alu", "alumni", "ciencia da computação", "2025-12-01");
        await inserir("Ina", "inativo", "BCC");
        await inserir("Ati", "ativo", "Eng. Mecânica");
        await inserir("Ele", "ativo", "engenharia eletrica");
        await inserir("Dir", "ativo", "Direito");
        await inserir("Nul", "trainee", null);
        await aplicarMigracoes(pool, PASTA, silencio);
    }, 60000);

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    const linha = async (nome: string) => (await pool.query("SELECT * FROM usuarios WHERE nome = $1", [nome])).rows[0];

    test("alumni vira inativo com motivo Alumni e mantém a data de saída", async () => {
        const alu = await linha("Alu");
        expect(alu.status).toBe("inativo");
        expect(alu.motivo_saida).toBe("Alumni");
        expect(alu.data_saida.toISOString().slice(0, 10)).toBe("2025-12-01");
        expect((await linha("Ina")).motivo_saida).toBeNull();
    });

    test("cursos antigos são mapeados ou viram NULL", async () => {
        const cursos = (await pool.query("SELECT nome, curso FROM usuarios ORDER BY nome")).rows;
        expect(cursos).toEqual([
            { nome: "Alu", curso: "Ciência da Computação" },
            { nome: "Ati", curso: "Engenharia Mecânica" },
            { nome: "Dir", curso: null },
            { nome: "Ele", curso: "Engenharia Elétrica" },
            { nome: "Ina", curso: "Ciência da Computação" },
            { nome: "Nul", curso: null },
        ]);
    });

    test("fim_trainee fica NULL para todos", async () => {
        expect((await pool.query("SELECT count(*)::int AS n FROM usuarios WHERE fim_trainee IS NOT NULL")).rows[0].n).toBe(0);
    });

    test("status alumni e curso fora da lista são barrados", async () => {
        await expect(inserir("Novo", "alumni", null)).rejects.toThrow();
        await expect(pool.query("UPDATE usuarios SET curso = 'Direito' WHERE nome = 'Ati'")).rejects.toThrow(/usuarios_curso_valido/);
        expect((await linha("Ati")).status).toBe("ativo");
    });

    test("o repositório grava e lê e-mail pessoal, motivo e fim do trainee", async () => {
        const repo = new UsuarioRepositoryDatabase(new PgConexao(pool));
        const ina = await repo.buscarPorEmail("ina@x.com");
        const editado = ina!.copiar({
            emailPessoal: "Ina.Pessoal@Gmail.com",
            motivoSaida: "Mudou de cidade",
            fimTrainee: new Date("2025-06-10T12:00:00Z"),
        });
        await repo.editar(editado);
        const lido = await repo.buscarPorCodigo(ina!.codigo);
        expect(lido!.emailPessoal).toBe("ina.pessoal@gmail.com");
        expect(lido!.motivoSaida).toBe("Mudou de cidade");
        expect(lido!.fimTrainee!.toISOString().slice(0, 10)).toBe("2025-06-10");
    });
});
