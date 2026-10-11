import express from "express";
import swaggerUi from "swagger-ui-express";
import Auth from "./Middleware/Auth";
import Http from "./Http";
import HttpMethods from "./HttpMethods";

export default class ExpressHttp implements Http {
    private readonly app: any;

    constructor(private readonly auth: Auth) {
        this.app = express();
        this.app.use(express.json());
        this.app.use((req: any, res: any, next: any) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
            res.header("Access-Control-Allow-Headers", "Content-Type, access-token");
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
                console.error(exception);
                res.status(422).json({ message: exception.message });
            }
        });
        this.app[method](url, ...handlers);
    }

    async route(method: HttpMethods, url: string, auth: boolean, callback: any): Promise<any> {
        this.registerRoute(method, url, callback, auth);
    }

    swagger(specification: object): void {
        this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specification));
        this.app.get("/api-docs.json", (_req: any, res: any) => res.json(specification));
    }

    async listen(port: number): Promise<void> {
        await this.app.listen(port);
    }
}
