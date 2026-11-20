import { CookieResposta } from "../../shared/seguranca/cookieLembrete";

/**
 * Resposta JSON que também grava ou apaga cookies (sessão 25a, "Manter conectado").
 * O ExpressHttp transforma cada cookie em Set-Cookie com os atributos de `cookieLembrete.ts`.
 * `status` serve às respostas de erro que também apagam o cookie (POST /auth/retomar).
 */
export default class RespostaComCookies {
    constructor(
        readonly corpo: unknown,
        readonly cookies: CookieResposta[],
        readonly status = 200,
    ) {}
}
