/**
 * Middleware de autenticação das rotas com login. Interface separada do Express para o
 * ExpressHttp não depender de como o token é conferido (implementação em AuthExpress.ts).
 */
export default interface Auth {
    execute(request: any, response: any, next: any): any;
}
