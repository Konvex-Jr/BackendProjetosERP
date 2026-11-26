/**
 * Grade de permissões (sessão 31a) contra PostgreSQL de verdade: a mudança vale na chamada seguinte.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { hash } from "bcrypt";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import ExpressHttp from "../../source/infra/http/ExpressHttp";
import ExpressAuth from "../../source/infra/http/middleware/AuthExpress";
import Router from "../../source/infra/http/Router";
import { PADRAO_GERENTE, Permissao } from "../../source/shared/seguranca/catalogoPermissoes";
import { darCargoNoBanco } from "./papelBanco";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const SENHA = "Senha@Forte1";

descrever("grade de permissões contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let http: ExpressHttp;
    let base = "";
    const tokens: Record<string, string> = {};

    const chamar = async (metodo: string, caminho: string, token: string, corpo?: unknown) => {
        const r = await fetch(`${base}${caminho}`, {
            method: metodo,
            headers: { "access-token": token, ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}) },
            body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        });
        const texto = await r.text();
        return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
    };

    async function pessoa(nome: string, email: string, papel?: "presidente" | "gerente"): Promise<string> {
        const codigo = (
            await pool.query(
                `INSERT INTO usuarios (codigo, nome, email, senioridade_codigo, ativo, senha_hash)
                 VALUES (gen_random_uuid(), $1, $2, NULL, TRUE, $3) RETURNING codigo`,
                [nome, email, await hash(SENHA, 4)],
            )
        ).rows[0].codigo;
        if (papel) await darCargoNoBanco(pool, codigo, papel);
        return codigo;
    }

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool, undefined, () => undefined);
        await pessoa("Presidenta", "pres@teste.com", "presidente");
        await pessoa("Gerente", "ger@teste.com", "gerente");
        conexao = PgConexao.criar(URL_TESTE!);
        const factory = new DatabaseRepositoryFactory(conexao);
        http = new ExpressHttp(new ExpressAuth(factory));
        new Router(http, factory).init();
        await http.listen(0);
        base = `http://127.0.0.1:${http.porta()}`;
        for (const [chave, email] of [
            ["pres", "pres@teste.com"],
            ["ger", "ger@teste.com"],
        ]) {
            const r = await fetch(`${base}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha: SENHA }),
            });
            tokens[chave] = (await r.json()).token;
        }
    }, 60000);

    afterAll(async () => {
        await http?.close();
        await conexao?.encerrar();
        await pool?.end();
    });

    test("presidente tira Relatórios do gerente; a chamada seguinte do gerente já não tem", async () => {
        const antes = await chamar("GET", "/auth/permissoes", tokens.ger);
        expect(antes.corpo.permissoes).toContain(Permissao.ESTRATEGIA_VER);
        expect(antes.corpo.cargo).toMatchObject({ nome: "Gerente de teste", posicao: 3 });

        const grade = await chamar("GET", "/permissoes", tokens.pres);
        expect(grade.status).toBe(200);
        const coluna = grade.corpo.colunas.find((c: any) => c.nome === "Gerente de teste");
        expect(coluna.podeAlterar).toBe(true);

        const sem = PADRAO_GERENTE.filter((p) => p !== Permissao.ESTRATEGIA_VER);
        const salvo = await chamar("PUT", `/permissoes/${coluna.chave}`, tokens.pres, { permissoes: sem });
        expect(salvo.status).toBe(200);

        const depois = await chamar("GET", "/auth/permissoes", tokens.ger);
        expect(depois.corpo.permissoes).not.toContain(Permissao.ESTRATEGIA_VER);
        expect(depois.corpo.menu.map((m: any) => m.chave)).not.toContain("estrategia");
    });

    test("gerente sem permissoes.gerir: grade 403", async () => {
        expect((await chamar("GET", "/permissoes", tokens.ger)).status).toBe(403);
        expect((await chamar("PUT", "/permissoes/sem_cargo", tokens.ger, { permissoes: [] })).status).toBe(403);
    });
});
