import EnvioEmailMemoria from "../../source/infra/email/EnvioEmailMemoria";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { hashToken } from "../../source/useCases/auth/emitirSessao";
import { cadastrarComSenha, criarContexto } from "../fixtures";
import { subirServidor } from "./servidorTeste";

const SENHA = "Senha@forte1";
const DIA = 24 * 60 * 60 * 1000;

/** Valor do cookie konvex_lembrar num Set-Cookie (null se não houver). */
function lerSetCookie(headers: Headers): string | null {
    const linhas = headers.getSetCookie();
    return linhas.find((l) => l.startsWith("konvex_lembrar=")) ?? null;
}

function valorCookie(linha: string | null): string {
    return linha ? linha.split(";")[0].slice("konvex_lembrar=".length) : "";
}

describe("Manter conectado (cookie de lembrete)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    const caminhoAntes = process.env.COOKIE_CAMINHO;
    const origensAntes = process.env.CORS_ORIGINS;

    beforeEach(async () => {
        delete process.env.COOKIE_CAMINHO;
        process.env.CORS_ORIGINS = "http://localhost:5173";
        ctx = await criarContexto();
        await cadastrarComSenha(
            ctx.factory,
            { nome: "Ana Dev", email: "ana@dev.konvex", perfil: PerfilUsuario.MEMBRO, senioridade: ctx.senioridade },
            SENHA,
        );
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => {
        await servidor.fechar();
        if (caminhoAntes === undefined) delete process.env.COOKIE_CAMINHO;
        else process.env.COOKIE_CAMINHO = caminhoAntes;
        if (origensAntes === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = origensAntes;
    });

    const login = (manterConectado?: boolean, cookie?: string) =>
        servidor.chamar("post", "/auth/login", {
            corpo: { email: "ana@dev.konvex", senha: SENHA, ...(manterConectado === undefined ? {} : { manterConectado }) },
            cabecalhos: cookie ? { Cookie: `konvex_lembrar=${cookie}` } : {},
        });
    const retomar = (cookie?: string) =>
        servidor.chamar("post", "/auth/retomar", { cabecalhos: cookie ? { Cookie: `outro=1; konvex_lembrar=${cookie}` } : {} });

    it("login com manterConectado grava o cookie HttpOnly por 15 dias, fora do corpo", async () => {
        const r = await login(true);
        expect(r.status).toBe(200);
        const linha = lerSetCookie(r.headers)!;
        expect(linha).toBeTruthy();
        expect(linha).toMatch(/; HttpOnly/);
        expect(linha).toMatch(/; SameSite=Strict/);
        expect(linha).toMatch(/; Path=\/auth(;|$)/);
        expect(linha).not.toMatch(/Secure/);
        const maxAge = Number(/Max-Age=(\d+)/.exec(linha)![1]);
        expect(Math.abs(maxAge - 15 * 24 * 60 * 60)).toBeLessThan(10);
        const token = valorCookie(linha);
        expect(token.length).toBeGreaterThan(20);
        expect(JSON.stringify(r.corpo)).not.toContain(token);
        expect(r.corpo.refreshToken).toBeTruthy();
        expect(r.corpo.refreshToken).not.toBe(token);
        const registro = await ctx.factory.criarRefreshTokenRepository().buscarPorHash(hashToken(token));
        expect(registro?.lembrar).toBe(true);
    });

    it("COOKIE_CAMINHO muda o Path", async () => {
        process.env.COOKIE_CAMINHO = "/api/auth";
        const linha = lerSetCookie((await login(true)).headers)!;
        expect(linha).toMatch(/; Path=\/api\/auth(;|$)/);
    });

    it("em produção o cookie leva Secure", async () => {
        const antes = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
            expect(lerSetCookie((await login(true)).headers)).toMatch(/; Secure(;|$)/);
        } finally {
            process.env.NODE_ENV = antes;
        }
    });

    it("usar o link de senha apaga o cookie e o lembrete deixa de valer", async () => {
        const c0 = valorCookie(lerSetCookie((await login(true)).headers));
        const envio = ctx.factory.criarEnvioEmail() as EnvioEmailMemoria;
        await servidor.chamar("post", "/auth/esqueci-senha", { corpo: { email: "ana@dev.konvex" } });
        await new Promise((r) => setTimeout(r, 50));
        const link = envio.ultimoLink("ana@dev.konvex")!;
        const r = await servidor.chamar("post", `/auth/link-senha/${link}`, {
            corpo: { senha: "Outra@senha2", confirmacao: "Outra@senha2" },
            cabecalhos: { Cookie: `konvex_lembrar=${c0}` },
        });
        expect(r.status).toBe(200);
        expect(r.corpo.token).toBeTruthy();
        expect(lerSetCookie(r.headers)).toMatch(/^konvex_lembrar=;.*Max-Age=0/);
        expect((await retomar(c0)).status).toBe(401);
    });

    it("retomar com o cookie dá sessão nova e cookie novo com o mesmo prazo", async () => {
        const tokenLogin = valorCookie(lerSetCookie((await login(true)).headers));
        const original = await ctx.factory.criarRefreshTokenRepository().buscarPorHash(hashToken(tokenLogin));
        const r = await retomar(tokenLogin);
        expect(r.status).toBe(200);
        expect(r.corpo.token).toBeTruthy();
        expect(r.corpo.refreshToken).toBeTruthy();
        const novo = valorCookie(lerSetCookie(r.headers));
        expect(novo).toBeTruthy();
        expect(novo).not.toBe(tokenLogin);
        const registroNovo = await ctx.factory.criarRefreshTokenRepository().buscarPorHash(hashToken(novo));
        expect(registroNovo?.lembrar).toBe(true);
        expect(registroNovo?.expiraEm.getTime()).toBe(original!.expiraEm.getTime());
        // A sessão de aba não é de lembrete.
        const aba = await ctx.factory.criarRefreshTokenRepository().buscarPorHash(hashToken(r.corpo.refreshToken));
        expect(aba?.lembrar).toBe(false);
        // E abre /auth/me.
        const me = await servidor.chamar("get", "/auth/me", { cabecalhos: { "access-token": r.corpo.token } });
        expect(me.status).toBe(200);
    });

    it("duas retomadas em sequência com o cookie devolvido pela anterior funcionam", async () => {
        const c0 = valorCookie(lerSetCookie((await login(true)).headers));
        const r1 = await retomar(c0);
        expect(r1.status).toBe(200);
        const r2 = await retomar(valorCookie(lerSetCookie(r1.headers)));
        expect(r2.status).toBe(200);
        expect(r2.corpo.refreshToken).not.toBe(r1.corpo.refreshToken);
        // As duas sessões de aba seguem válidas, cada uma com o próprio refresh.
        expect((await servidor.chamar("post", "/auth/refresh", { corpo: { refreshToken: r1.corpo.refreshToken } })).status).toBe(200);
        expect((await servidor.chamar("post", "/auth/refresh", { corpo: { refreshToken: r2.corpo.refreshToken } })).status).toBe(200);
    });

    it("cookie já girado reapresentado: 401, cookie apagado e todas as sessões revogadas", async () => {
        const c0 = valorCookie(lerSetCookie((await login(true)).headers));
        const r1 = await retomar(c0);
        const r = await retomar(c0);
        expect(r.status).toBe(401);
        const linha = lerSetCookie(r.headers)!;
        expect(linha).toMatch(/^konvex_lembrar=;/);
        expect(linha).toMatch(/Max-Age=0/);
        expect((await retomar(valorCookie(lerSetCookie(r1.headers)))).status).toBe(401);
        expect((await servidor.chamar("post", "/auth/refresh", { corpo: { refreshToken: r1.corpo.refreshToken } })).status).toBe(401);
    });

    it("sem cookie ou com cookie desconhecido: 401", async () => {
        expect((await retomar()).status).toBe(401);
        expect((await retomar("inexistente")).status).toBe(401);
    });

    it("refresh com o token de lembrete no corpo: 401", async () => {
        const c0 = valorCookie(lerSetCookie((await login(true)).headers));
        const r = await servidor.chamar("post", "/auth/refresh", { corpo: { refreshToken: c0 } });
        expect(r.status).toBe(401);
        // Não estraga o lembrete.
        expect((await retomar(c0)).status).toBe(200);
    });

    it("refresh token de aba não serve para retomar", async () => {
        const r = await login(false);
        expect((await retomar(r.corpo.refreshToken)).status).toBe(401);
    });

    it("login sem manterConectado com cookie antigo apaga o cookie e revoga o lembrete", async () => {
        const c0 = valorCookie(lerSetCookie((await login(true)).headers));
        const r = await login(false, c0);
        expect(r.status).toBe(200);
        const linha = lerSetCookie(r.headers)!;
        expect(linha).toMatch(/^konvex_lembrar=;/);
        expect(linha).toMatch(/Max-Age=0/);
        expect((await retomar(c0)).status).toBe(401);
    });

    it("login com manterConectado e cookie antigo troca o cookie e revoga o antigo", async () => {
        const c0 = valorCookie(lerSetCookie((await login(true)).headers));
        const r = await login(true, c0);
        const c1 = valorCookie(lerSetCookie(r.headers));
        expect(c1).not.toBe(c0);
        expect((await retomar(c1)).status).toBe(200);
    });

    it("logout revoga o refresh e o lembrete e apaga o cookie", async () => {
        const l = await login(true);
        const c0 = valorCookie(lerSetCookie(l.headers));
        const r = await servidor.chamar("post", "/auth/logout", {
            corpo: { refreshToken: l.corpo.refreshToken },
            cabecalhos: { Cookie: `konvex_lembrar=${c0}` },
        });
        expect(r.status).toBe(200);
        expect(lerSetCookie(r.headers)).toMatch(/^konvex_lembrar=;.*Max-Age=0/);
        expect((await retomar(c0)).status).toBe(401);
        expect((await servidor.chamar("post", "/auth/refresh", { corpo: { refreshToken: l.corpo.refreshToken } })).status).toBe(401);
    });

    it("logout sem corpo nem cookie responde 200 e apaga o cookie", async () => {
        const r = await servidor.chamar("post", "/auth/logout");
        expect(r.status).toBe(200);
        expect(lerSetCookie(r.headers)).toMatch(/Max-Age=0/);
    });

    it("origem permitida recebe Access-Control-Allow-Credentials: true; outra não", async () => {
        const ok = await servidor.chamar("post", "/auth/retomar", { cabecalhos: { Origin: "http://localhost:5173" } });
        expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
        const fora = await servidor.chamar("post", "/auth/retomar", { cabecalhos: { Origin: "http://mal.exemplo" } });
        expect(fora.headers.get("access-control-allow-credentials")).toBeNull();
    });

    it("lembrete vencido: 401", async () => {
        const c0 = valorCookie(lerSetCookie((await login(true)).headers));
        const repo = ctx.factory.criarRefreshTokenRepository();
        const registro = await repo.buscarPorHash(hashToken(c0));
        // Simula o prazo de 15 dias vencido.
        jest.spyOn(Date, "now").mockReturnValue(registro!.expiraEm.getTime() + DIA);
        try {
            expect((await retomar(c0)).status).toBe(401);
        } finally {
            jest.restoreAllMocks();
        }
    });
});
