/**
 * Integração do fluxo de conta (sessão 25a) contra PostgreSQL de verdade: convite por e-mail, criação
 * da senha pelo link, "Manter conectado" (retomar e logout) e "Esqueci a senha".
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { hash } from "bcrypt";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import EnvioEmailMemoria from "../../source/infra/email/EnvioEmailMemoria";
import ExpressHttp from "../../source/infra/http/ExpressHttp";
import ExpressAuth from "../../source/infra/http/middleware/AuthExpress";
import Router from "../../source/infra/http/Router";
import { darCargoNoBanco } from "./papelBanco";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;

const SENHA_DIRETORA = "Diretora@123";
const SENHA_NOVA = "Nova@senha1";
const EMAIL_NOVA = "nova.pessoa@konvexjr.com.br";

descrever("conta e senha contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let http: ExpressHttp;
    let base = "";
    let tokenDiretora = "";
    const envio = new EnvioEmailMemoria();
    const ambienteAntes = { EMAIL_DOMINIO: process.env.EMAIL_DOMINIO, COOKIE_CAMINHO: process.env.COOKIE_CAMINHO };
    const envioAntes = (DatabaseRepositoryFactory as any).envioEmail;

    const chamar = async (metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) => {
        const r = await fetch(base + caminho, {
            method: metodo,
            headers: { ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}), ...cabecalhos },
            body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        });
        const texto = await r.text();
        let json: any = null;
        try {
            json = texto ? JSON.parse(texto) : null;
        } catch {
            json = texto;
        }
        return { status: r.status, json, texto, headers: r.headers };
    };
    const cookieLembrete = (headers: Headers) => headers.getSetCookie().find((l) => l.startsWith("konvex_lembrar=")) ?? "";
    const valorCookie = (linha: string) => linha.split(";")[0].slice("konvex_lembrar=".length);
    const login = (email: string, senha: string, manterConectado?: boolean, cookie?: string) =>
        chamar("POST", "/auth/login", { email, senha, manterConectado }, cookie ? { Cookie: `konvex_lembrar=${cookie}` } : {});

    beforeAll(async () => {
        process.env.EMAIL_DOMINIO = "konvexjr.com.br";
        process.env.COOKIE_CAMINHO = "/auth";
        (DatabaseRepositoryFactory as any).envioEmail = envio;
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        const {
            rows: [{ codigo: codigoAdmin }],
        } = await pool.query(
            `INSERT INTO usuarios (codigo, nome, email, senioridade_codigo, ativo, senha_hash)
             VALUES (gen_random_uuid(), 'Diretora', 'diretora@konvexjr.com.br', NULL, TRUE, $1) RETURNING codigo`,
            [await hash(SENHA_DIRETORA, 4)],
        );
        await darCargoNoBanco(pool, codigoAdmin, "presidente");
        conexao = PgConexao.criar(URL_TESTE!);
        const factory = new DatabaseRepositoryFactory(conexao);
        http = new ExpressHttp(new ExpressAuth(factory));
        new Router(http, factory).init();
        await http.listen(0);
        base = `http://127.0.0.1:${http.porta()}`;
        tokenDiretora = (await login("diretora@konvexjr.com.br", SENHA_DIRETORA)).json.token;
    }, 60000);

    afterAll(async () => {
        await http?.close();
        await conexao?.encerrar();
        await pool?.end();
        (DatabaseRepositoryFactory as any).envioEmail = envioAntes;
        for (const [nome, valor] of Object.entries(ambienteAntes)) {
            if (valor === undefined) delete process.env[nome];
            else process.env[nome] = valor;
        }
    });

    test("convite: e-mail de fora do domínio é 400; o link nunca aparece na resposta", async () => {
        const fora = await chamar(
            "POST",
            "/usuarios",
            { nome: "Fora", email: "fora@gmail.com", perfil: "gerente", codigoSenioridade: "lideranca", curso: "Engenharia Mecânica" },
            { "access-token": tokenDiretora },
        );
        expect(fora.status).toBe(400);

        const criada = await chamar(
            "POST",
            "/usuarios",
            { nome: "Nova Pessoa", email: EMAIL_NOVA, perfil: "gerente", codigoSenioridade: "lideranca", curso: "Engenharia Mecânica" },
            { "access-token": tokenDiretora },
        );
        expect(criada.status).toBe(200);
        expect(criada.json.conviteEnviado).toBe(true);
        const token = envio.ultimoLink(EMAIL_NOVA)!;
        expect(token).toBeTruthy();
        expect(criada.texto).not.toContain(token);
    });

    test("criar a senha pelo link, uma vez só, e entrar", async () => {
        const token = envio.ultimoLink(EMAIL_NOVA)!;
        const consulta = await chamar("GET", `/auth/link-senha/${token}`);
        expect(consulta.status).toBe(200);
        expect(consulta.texto).not.toContain(token);

        const fraca = await chamar("POST", `/auth/link-senha/${token}`, { senha: "fraca", confirmacao: "fraca" });
        expect(fraca.status).toBe(400);
        const diferente = await chamar("POST", `/auth/link-senha/${token}`, { senha: SENHA_NOVA, confirmacao: "Outra@senha1" });
        expect(diferente.status).toBe(400);

        const usado = await chamar("POST", `/auth/link-senha/${token}`, { senha: SENHA_NOVA, confirmacao: SENHA_NOVA });
        expect(usado.status).toBe(200);
        expect(usado.json.token).toBeTruthy();

        const denovo = await chamar("POST", `/auth/link-senha/${token}`, { senha: SENHA_NOVA, confirmacao: SENHA_NOVA });
        expect(denovo.status).toBeGreaterThanOrEqual(400);
        expect(denovo.status).toBeLessThan(500);
        expect((await chamar("GET", `/auth/link-senha/${token}`)).status).toBeGreaterThanOrEqual(400);

        expect((await login(EMAIL_NOVA, SENHA_NOVA)).status).toBe(200);
        expect((await login(EMAIL_NOVA, "Errada@123")).status).toBe(401);
    });

    test("manter conectado: retomar gira o cookie, reapresentar derruba tudo, logout apaga", async () => {
        const entrada = await login(EMAIL_NOVA, SENHA_NOVA, true);
        const linha = cookieLembrete(entrada.headers);
        expect(linha).toMatch(/HttpOnly/);
        expect(entrada.texto).not.toContain(valorCookie(linha));
        const c0 = valorCookie(linha);

        const r1 = await chamar("POST", "/auth/retomar", undefined, { Cookie: `konvex_lembrar=${c0}` });
        expect(r1.status).toBe(200);
        expect(r1.json.token).toBeTruthy();
        const c1 = valorCookie(cookieLembrete(r1.headers));
        expect(c1).not.toBe(c0);

        const reuso = await chamar("POST", "/auth/retomar", undefined, { Cookie: `konvex_lembrar=${c0}` });
        expect(reuso.status).toBe(401);
        expect(cookieLembrete(reuso.headers)).toMatch(/Max-Age=0/);
        // Reapresentar o antigo encerrou também o novo.
        expect((await chamar("POST", "/auth/retomar", undefined, { Cookie: `konvex_lembrar=${c1}` })).status).toBe(401);

        const e2 = await login(EMAIL_NOVA, SENHA_NOVA, true);
        const c2 = valorCookie(cookieLembrete(e2.headers));
        const sair = await chamar("POST", "/auth/logout", { refreshToken: e2.json.refreshToken }, { Cookie: `konvex_lembrar=${c2}` });
        expect(sair.status).toBe(200);
        expect(cookieLembrete(sair.headers)).toMatch(/Max-Age=0/);
        expect((await chamar("POST", "/auth/retomar", undefined, { Cookie: `konvex_lembrar=${c2}` })).status).toBe(401);
    });

    test("esqueci a senha: mesma resposta com ou sem cadastro; redefinir encerra as sessões", async () => {
        const msg = "Se o e-mail estiver cadastrado, você vai receber um link em instantes.";
        const antes = envio.enviados.length;
        const desconhecido = await chamar("POST", "/auth/esqueci-senha", { email: "ninguem@konvexjr.com.br" });
        expect(desconhecido.status).toBe(200);
        expect(desconhecido.json.message).toBe(msg);
        expect(envio.enviados.length).toBe(antes);

        const e = await login(EMAIL_NOVA, SENHA_NOVA, true);
        const c = valorCookie(cookieLembrete(e.headers));
        const conhecido = await chamar("POST", "/auth/esqueci-senha", { email: EMAIL_NOVA });
        expect(conhecido.status).toBe(200);
        expect(conhecido.json.message).toBe(msg);
        // O envio é feito sem esperar a resposta (para não revelar se o e-mail existe).
        for (let i = 0; i < 50 && envio.enviados.length === antes; i++) await new Promise((r) => setTimeout(r, 20));
        expect(envio.enviados.length).toBe(antes + 1);
        const token = envio.ultimoLink(EMAIL_NOVA)!;

        const nova = "Outra@senha2";
        expect((await chamar("POST", `/auth/link-senha/${token}`, { senha: nova, confirmacao: nova })).status).toBe(200);
        expect((await login(EMAIL_NOVA, SENHA_NOVA)).status).toBe(401);
        expect((await login(EMAIL_NOVA, nova)).status).toBe(200);
        // O cookie de antes da redefinição não vale mais.
        expect((await chamar("POST", "/auth/retomar", undefined, { Cookie: `konvex_lembrar=${c}` })).status).toBe(401);
        expect((await chamar("POST", "/auth/refresh", { refreshToken: e.json.refreshToken })).status).toBe(401);
    });

    test("ninguém define a senha de outra pessoa: PUT /usuarios/:codigo/senha não existe", async () => {
        const lista = await chamar("GET", "/usuarios", undefined, { "access-token": tokenDiretora });
        const alvo = (lista.json.usuarios ?? lista.json).find((u: any) => u.email === EMAIL_NOVA);
        const r = await chamar("PUT", `/usuarios/${alvo.codigo}/senha`, { senha: "Qualquer@123" }, { "access-token": tokenDiretora });
        expect(r.status).toBe(404);
        expect(JSON.stringify(alvo)).not.toMatch(/senha_?hash|"senha"/i);
    });
});
