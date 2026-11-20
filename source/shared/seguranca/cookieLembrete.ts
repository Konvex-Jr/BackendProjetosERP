/**
 * Cookie do "Manter conectado" (sessão 25a). Guarda só o token de lembrete, nunca o refresh de
 * uma aba: cada aba que reabre troca o lembrete por uma sessão própria em POST /auth/retomar.
 */
export const NOME_COOKIE_LEMBRETE = "konvex_lembrar";

export interface CookieResposta {
    nome: string;
    valor: string;
    /** `null` apaga o cookie (Max-Age=0). */
    expiraEm: Date | null;
}

/**
 * Caminho do cookie: só as rotas de sessão o recebem. Padrão `/auth`; em produção `/api/auth`,
 * porque o navegador vê o caminho antes de o Traefik tirar o `/api`. Lido a cada uso.
 */
export function caminhoCookie(): string {
    return process.env.COOKIE_CAMINHO || "/auth";
}

/** Monta o cabeçalho Set-Cookie com os atributos fixos (HttpOnly, SameSite=Strict, Secure em produção). */
export function formatarCookie(cookie: CookieResposta, agora = Date.now()): string {
    const partes = [`${cookie.nome}=${cookie.expiraEm ? encodeURIComponent(cookie.valor) : ""}`];
    if (cookie.expiraEm) {
        const segundos = Math.max(0, Math.floor((cookie.expiraEm.getTime() - agora) / 1000));
        partes.push(`Max-Age=${segundos}`, `Expires=${cookie.expiraEm.toUTCString()}`);
    } else {
        partes.push("Max-Age=0", `Expires=${new Date(0).toUTCString()}`);
    }
    partes.push(`Path=${caminhoCookie()}`, "HttpOnly", "SameSite=Strict");
    if (process.env.NODE_ENV === "production") partes.push("Secure");
    return partes.join("; ");
}

/** Lê o cabeçalho Cookie (`a=1; b=2`) sem dependência externa. Valor mal codificado fica como veio. */
export function lerCookies(cabecalho: unknown): Record<string, string> {
    const cookies: Record<string, string> = Object.create(null);
    if (typeof cabecalho !== "string") return cookies;
    for (const parte of cabecalho.split(";")) {
        const igual = parte.indexOf("=");
        if (igual <= 0) continue;
        const nome = parte.slice(0, igual).trim();
        let valor = parte.slice(igual + 1).trim();
        if (valor.startsWith('"') && valor.endsWith('"') && valor.length >= 2) valor = valor.slice(1, -1);
        try {
            valor = decodeURIComponent(valor);
        } catch {
            // mantém o valor cru
        }
        if (nome && !(nome in cookies)) cookies[nome] = valor;
    }
    return cookies;
}

/** Cookie novo do lembrete. */
export function cookieLembrete(token: string, expiraEm: Date): CookieResposta {
    return { nome: NOME_COOKIE_LEMBRETE, valor: token, expiraEm };
}

/** Cookie que apaga o lembrete do navegador. */
export function apagarCookieLembrete(): CookieResposta {
    return { nome: NOME_COOKIE_LEMBRETE, valor: "", expiraEm: null };
}
