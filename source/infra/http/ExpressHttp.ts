import express from "express";
import swaggerUi from "swagger-ui-express";
import Auth from "./Middleware/Auth";
import Http from "./Http";
import HttpMethods from "./HttpMethods";
import { ErroAplicacao } from "../../shared/erros/ErroAplicacao";

/** Origens autorizadas a chamar a API pelo navegador (CORS_ORIGINS, separadas por vírgula). */
export function origensCors(): string[] {
    const configuradas = process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:4173";
    return configuradas.split(",").map((origem) => origem.trim()).filter(Boolean);
}

/**
 * Converte exceções em respostas HTTP. Erros da aplicação usam o próprio status;
 * erros do banco viram 500 sem expor detalhes internos.
 */
export function responderErro(res: any, exception: any): void {
    if (exception instanceof ErroAplicacao) {
        res.status(exception.codigoHttp).json({ message: exception.message, codigo: exception.codigo });
        return;
    }
    if (exception && typeof exception === "object" && "severity" in exception) {
        console.error(exception);
        res.status(500).json({ message: "Erro interno ao acessar o banco de dados." });
        return;
    }
    console.error(exception);
    res.status(422).json({ message: exception?.message ?? "Não foi possível concluir a operação." });
}

export default class ExpressHttp implements Http {
    private readonly app: any;
    private server: any;

    constructor(private readonly auth: Auth) {
        this.app = express();
        this.app.use(express.json({ limit: "2mb" }));
        const origensPermitidas = origensCors();
        this.app.use((req: any, res: any, next: any) => {
            const origem = req.headers.origin;
            if (origem && origensPermitidas.includes(origem)) {
                res.header("Access-Control-Allow-Origin", origem);
                res.header("Vary", "Origin");
                res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
                res.header("Access-Control-Allow-Headers", "Content-Type, access-token");
            }
            next();
        });
        this.app.options("*", (_req: any, res: any) => res.end());
    }

    private registerRoute(method: HttpMethods, url: string, callback: any, authRequired: boolean): void {
        const handlers = authRequired ? [this.auth.execute.bind(this.auth)] : [];
        handlers.push(async (req: any, res: any) => {
            try {
                const result = await callback(req.params, req.body, req.query);
                res.json(result === undefined ? { message: "Operação realizada com sucesso." } : result);
            } catch (exception: any) {
                responderErro(res, exception);
            }
        });
        this.app[method](url, ...handlers);
    }

    async route(method: HttpMethods, url: string, auth: boolean, callback: any): Promise<any> {
        this.registerRoute(method, url, callback, auth);
    }

    swagger(specification: object): void {
        // Em produção, a documentação só fica pública se SWAGGER_ENABLED=true.
        const habilitado = process.env.SWAGGER_ENABLED
            ? process.env.SWAGGER_ENABLED === "true"
            : process.env.NODE_ENV !== "production";
        if (!habilitado) return;
        this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specification));
        this.app.get("/api-docs.json", (_req: any, res: any) => res.json(specification));
    }

    async listen(port: number): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            this.server = this.app.listen(port, () => resolve());
            this.server.once("error", reject);
        });
    }

    /** Porta efetiva (útil quando o servidor sobe na porta 0, nos testes). */
    porta(): number {
        return this.server?.address()?.port ?? 0;
    }

    async close(): Promise<void> {
        if (!this.server) return;
        await new Promise<void>((resolve) => this.server.close(() => resolve()));
    }
}
