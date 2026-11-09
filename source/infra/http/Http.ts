import HttpMethods from "./HttpMethods";

export interface OpcoesRota {
    /**
     * Rota que recebe um arquivo no corpo (bytes crus, até `limiteBytes`). O nome vem no
     * cabeçalho X-Nome-Arquivo (codificado com encodeURIComponent). O callback recebe
     * `body.arquivo = { nome, conteudo }` e `body.user`.
     */
    arquivo?: { limiteBytes: number; mensagemLimite: string };
}

export default interface Http {
    route(method: HttpMethods, url: string, auth: boolean, callback: any, opcoes?: OpcoesRota): Promise<any>;
    swagger(specification: object): void;
    listen(port: number): Promise<void>;
}
