/**
 * Migração 030 (sessão 31a: permissões por cargo) sobre um banco já na 029.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import {
    PADRAO_DIRETOR,
    PADRAO_GERENTE,
    PADRAO_MEMBRO,
    PADRAO_TRAINEE,
    TODAS_AS_PERMISSOES,
} from "../../source/shared/seguranca/catalogoPermissoes";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const PASTA = path.resolve(__dirname, "../../migrations");
const silencio = () => undefined;
const ordenar = (l: readonly string[]) => [...l].sort();

descrever("migração 030 sobre a 029", () => {
    let pool: Pool;
    let antigas: string;

    beforeAll(() => {
        pool = new Pool({ connectionString: URL_TESTE });
        antigas = mkdtempSync(path.join(tmpdir(), "migracoes-"));
        for (const arquivo of readdirSync(PASTA).filter((a) => a.endsWith(".sql") && a < "030")) {
            copyFileSync(path.join(PASTA, arquivo), path.join(antigas, arquivo));
        }
    });

    afterAll(async () => {
        rmSync(antigas, { recursive: true, force: true });
        await pool?.end();
    });

    async function ate029() {
        // Pool novo a cada cenário: a 002 cria funções em pg_temp, que vivem na sessão.
        await pool.end();
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool, antigas, silencio);
    }

    async function area(nome: string): Promise<string> {
        const existente = (await pool.query("SELECT codigo FROM areas WHERE nome = $1", [nome])).rows[0];
        if (existente) return existente.codigo;
        return (await pool.query("INSERT INTO areas (nome) VALUES ($1) RETURNING codigo", [nome])).rows[0].codigo;
    }
    async function cargo(nome: string): Promise<string> {
        return (await pool.query("INSERT INTO cargos (nome) VALUES ($1) RETURNING codigo", [nome])).rows[0].codigo;
    }
    async function pessoa(nome: string, perfil: string, status = "ativo"): Promise<string> {
        return (
            await pool.query(
                `INSERT INTO usuarios (nome, email, perfil, ativo, senha_hash, status)
                 VALUES ($1, $2, $3, true, 'h', $4) RETURNING codigo`,
                [nome, `${nome}@x.com`, perfil, status],
            )
        ).rows[0].codigo;
    }
    async function periodo(usuario: string, codigoArea: string, codigoCargo: string | null, fim: string | null = null) {
        await pool.query(
            "INSERT INTO periodos_area (usuario_codigo, area_codigo, cargo_codigo, inicio, fim) VALUES ($1, $2, $3, '2026-01-01', $4)",
            [usuario, codigoArea, codigoCargo, fim],
        );
    }
    async function permissoesDo(codigoCargo: string): Promise<string[]> {
        return (await pool.query("SELECT permissao FROM cargo_permissoes WHERE cargo_codigo = $1", [codigoCargo])).rows.map(
            (r) => r.permissao,
        );
    }
    async function posicaoDo(codigoCargo: string): Promise<number> {
        return (await pool.query("SELECT posicao FROM cargos WHERE codigo = $1", [codigoCargo])).rows[0].posicao;
    }

    test("cargos recebem as permissões do perfil mais baixo dos ocupantes e a posição", async () => {
        await ate029();
        const projetos = await area("Projetos");
        const presidencia = await area("Presidência");
        const presidente = await cargo("Presidente");
        const diretor = await cargo("Diretor de projetos");
        const misto = await cargo("Gerente de projetos");
        const assessor = await cargo("Assessor");
        const encerrado = await cargo("Cargo encerrado");
        await periodo(await pessoa("Pres", "diretor"), presidencia, presidente);
        await periodo(await pessoa("Dir", "diretor"), projetos, diretor);
        await periodo(await pessoa("Ger1", "diretor"), projetos, misto);
        await periodo(await pessoa("Ger2", "gerente"), projetos, misto);
        // Período encerrado não conta: o "Cargo encerrado" fica sem ocupante.
        await periodo(await pessoa("Antigo", "diretor"), projetos, encerrado, "2026-02-01");

        await aplicarMigracoes(pool, PASTA, silencio);

        expect(await posicaoDo(presidente)).toBe(1);
        expect(ordenar(await permissoesDo(presidente))).toEqual(ordenar(TODAS_AS_PERMISSOES));
        expect(await posicaoDo(diretor)).toBe(2);
        expect(ordenar(await permissoesDo(diretor))).toEqual(ordenar(PADRAO_DIRETOR));
        expect(await posicaoDo(misto)).toBe(3);
        expect(ordenar(await permissoesDo(misto))).toEqual(ordenar(PADRAO_GERENTE));
        expect(await posicaoDo(assessor)).toBe(4);
        expect(ordenar(await permissoesDo(assessor))).toEqual(ordenar(PADRAO_MEMBRO));
        expect(await posicaoDo(encerrado)).toBe(4);

        const conjuntos = (await pool.query("SELECT conjunto, permissao FROM conjunto_permissoes")).rows;
        expect(ordenar(conjuntos.filter((c) => c.conjunto === "sem_cargo").map((c) => c.permissao))).toEqual(ordenar(PADRAO_MEMBRO));
        expect(ordenar(conjuntos.filter((c) => c.conjunto === "trainee").map((c) => c.permissao))).toEqual(ordenar(PADRAO_TRAINEE));

        const colunas = async (tabela: string) =>
            (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [tabela])).rows.map(
                (r) => r.column_name,
            );
        expect(await colunas("usuarios")).not.toContain("perfil");
        expect(await colunas("projetos")).not.toContain("sigiloso");
        expect((await pool.query("SELECT 1 FROM pg_type WHERE typname = 'perfil_usuario'")).rowCount).toBe(0);

        // Um só presidente; posição 0 recusada.
        await expect(pool.query("UPDATE cargos SET posicao = 1 WHERE codigo = $1", [diretor])).rejects.toThrow();
        await expect(pool.query("UPDATE cargos SET posicao = 0 WHERE codigo = $1", [assessor])).rejects.toThrow();
    }, 60000);

    test("falha sem cargo de presidente quando há diretor", async () => {
        await ate029();
        await periodo(await pessoa("Dir", "diretor"), await area("Projetos"), await cargo("Diretor de projetos"));
        await expect(aplicarMigracoes(pool, PASTA, silencio)).rejects.toThrow(/presidente/i);
    }, 60000);

    test("falha com o cargo de presidente vago", async () => {
        await ate029();
        await cargo("Presidente");
        await periodo(await pessoa("Dir", "diretor"), await area("Projetos"), await cargo("Diretor de projetos"));
        await expect(aplicarMigracoes(pool, PASTA, silencio)).rejects.toThrow(/presidente/i);
    }, 60000);

    test("diretor sem nenhum cargo cadastrado (banco que não usa cargos): aplica sem presidente", async () => {
        await ate029();
        await pessoa("Dir", "diretor");
        await expect(aplicarMigracoes(pool, PASTA, silencio)).resolves.not.toThrow();
        expect((await pool.query("SELECT count(*)::int AS n FROM cargos")).rows[0].n).toBe(0);
    }, 60000);

    test("banco sem pessoas aplica sem erro", async () => {
        await ate029();
        await expect(aplicarMigracoes(pool, PASTA, silencio)).resolves.not.toThrow();
        expect((await pool.query("SELECT count(*)::int AS n FROM conjunto_permissoes")).rows[0].n).toBe(
            PADRAO_MEMBRO.length + PADRAO_TRAINEE.length,
        );
    }, 60000);
});
