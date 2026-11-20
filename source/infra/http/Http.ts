import HttpMethods from "./HttpMethods";

export interface OpcoesRota {
    /**
     * Rota que recebe um arquivo no corpo (bytes crus, até `limiteBytes`). O nome vem no
     * cabeçalho X-Nome-Arquivo (codificado com encodeURIComponent). O callback recebe
     * `body.arquivo = { nome, conteudo }` e `body.user`.
     */
    arquivo?: { limiteBytes: number; mensagemLimite: string; codigoLimite?: string };
}

/**
 * Contrato do servidor HTTP visto pelas rotas (implementado por ExpressHttp).
 * O callback de `route` recebe (params, body, query, contexto) e devolve o objeto da resposta (vira JSON)
 * ou uma RespostaArquivo / RespostaSemConteudo / RespostaComCookies; erros lançados viram status HTTP em `responderErro`.
 * Com `auth = true`, `body.user` traz a pessoa logada.
 */
/** Dados da requisição que não vêm no corpo: IP de origem e cookies (lidos do cabeçalho Cookie). */
export interface ContextoRequisicao {
    ip: string;
    cookies: Record<string, string>;
}

export default interface Http {
    route(method: HttpMethods, url: string, auth: boolean, callback: any, opcoes?: OpcoesRota): Promise<any>;
    swagger(specification: object): void;
    listen(port: number): Promise<void>;
}
