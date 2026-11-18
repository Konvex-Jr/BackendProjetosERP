/**
 * Integração das rotas da foto de perfil (sessão 22) contra PostgreSQL de verdade.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { hash } from "bcrypt";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import ExpressHttp from "../../source/infra/http/ExpressHttp";
import ExpressAuth from "../../source/infra/http/middleware/AuthExpress";
import Router from "../../source/infra/http/Router";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;

const webp = (extra = 10) => Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBP"), Buffer.alloc(extra, 7)]);

descrever("rotas da foto de perfil contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let http: ExpressHttp;
    let base = "";
    let token = "";
    let pasta = "";
    const anexosAntes = process.env.ANEXOS_DIR;

    const enviar = (corpo: Buffer, comToken = true) =>
        fetch(`${base}/auth/foto`, {
            method: "PUT",
            headers: { "Content-Type": "image/webp", ...(comToken ? { "access-token": token } : {}) },
            body: new Uint8Array(corpo),
        });

    beforeAll(async () => {
        pasta = mkdtempSync(path.join(tmpdir(), "fotos-"));
        process.env.ANEXOS_DIR = pasta;
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        await pool.query(
            `INSERT INTO usuarios (codigo, nome, email, perfil, senioridade_codigo, ativo, senha_hash)
             VALUES (gen_random_uuid(), 'Diretora', 'diretora@teste.com', 'diretor', NULL, TRUE, $1)`,
            [await hash("SenhaDiretora1", 4)],
        );
        conexao = PgConexao.criar(URL_TESTE!);
        const factory = new DatabaseRepositoryFactory(conexao);
        http = new ExpressHttp(new ExpressAuth(factory));
        new Router(http, factory).init();
        await http.listen(0);
        base = `http://127.0.0.1:${http.porta()}`;
        const login = await fetch(`${base}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "diretora@teste.com", senha: "SenhaDiretora1" }),
        });
        token = (await login.json()).token;
    }, 60000);

    afterAll(async () => {
        await http?.close();
        await conexao?.encerrar();
        await pool?.end();
        if (anexosAntes === undefined) delete process.env.ANEXOS_DIR;
        else process.env.ANEXOS_DIR = anexosAntes;
        if (pasta) rmSync(pasta, { recursive: true, force: true });
    });

    test("fluxo: enviar, servir sem login, aparecer em /auth/me, remover", async () => {
        const bytes = webp(50);
        const r = await enviar(bytes);
        expect(r.status).toBe(200);
        const { foto } = await r.json();
        expect(foto).toMatch(/\.webp$/);

        const g = await fetch(`${base}/fotos/${foto}`);
        expect(g.status).toBe(200);
        expect(g.headers.get("content-type")).toBe("image/webp");
        expect(g.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
        expect(g.headers.get("cross-origin-resource-policy")).toBe("same-site");
        expect(g.headers.get("x-content-type-options")).toBe("nosniff");
        expect(g.headers.get("content-disposition")).toMatch(/^inline/);
        expect(Buffer.from(await g.arrayBuffer()).equals(bytes)).toBe(true);

        const me = await fetch(`${base}/auth/me`, { headers: { "access-token": token } });
        expect((await me.json()).foto).toBe(foto);

        const d = await fetch(`${base}/auth/foto`, { method: "DELETE", headers: { "access-token": token } });
        expect(d.status).toBe(204);
        const depois = await fetch(`${base}/fotos/${foto}`);
        expect(depois.status).toBe(404);
        expect(await depois.json()).toMatchObject({ message: "Foto não encontrada." });
        const me2 = await fetch(`${base}/auth/me`, { headers: { "access-token": token } });
        expect((await me2.json()).foto ?? null).toBeNull();
    });

    test("GET /fotos recusa nome inválido e inexistente com 404", async () => {
        expect((await fetch(`${base}/fotos/..%2F..%2Fetc%2Fpasswd`)).status).toBe(404);
        const r = await fetch(`${base}/fotos/00000000-0000-4000-8000-000000000000.webp`);
        expect(r.status).toBe(404);
        expect(await r.json()).toMatchObject({ message: "Foto não encontrada." });
    });

    test("PUT /auth/foto exige login", async () => {
        expect((await enviar(webp(), false)).status).toBe(401);
    });

    test("PUT /auth/foto recusa PNG (400) e mais de 300 KB (413)", async () => {
        const png = Buffer.concat([Buffer.from([0x89]), Buffer.from("PNG\r\n\x1a\n"), Buffer.alloc(30)]);
        const r = await enviar(png);
        expect(r.status).toBe(400);
        expect((await r.json()).codigo).toBe("FOTO_FORMATO_INVALIDO");
        const grande = await enviar(webp(301 * 1024));
        expect(grande.status).toBe(413);
        const corpo = await grande.json();
        expect(corpo.message).toBe("A foto pode ter até 300 KB.");
        expect(corpo.codigo).toBe("FOTO_GRANDE_DEMAIS");
    });

    test("editar com leitura antiga não volta a foto (corrida com PUT /auth/foto)", async () => {
        const repo = new DatabaseRepositoryFactory(conexao).criarUsuarioRepository();
        const [{ codigo }] = (await pool.query("SELECT codigo FROM usuarios WHERE email = 'diretora@teste.com'")).rows;
        const antiga = await repo.buscarPorCodigo(codigo);
        expect((await enviar(webp())).status).toBe(200);
        const nova = (await pool.query("SELECT foto FROM usuarios WHERE codigo = $1", [codigo])).rows[0].foto;
        expect(nova).not.toBe(antiga!.foto);
        await repo.editar(antiga!);
        expect((await pool.query("SELECT foto FROM usuarios WHERE codigo = $1", [codigo])).rows[0].foto).toBe(nova);
    });
});
