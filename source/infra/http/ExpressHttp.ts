import express from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import swaggerUi from "swagger-ui-express";
import Auth from "./Middleware/Auth";
import Http from "./Http";
import HttpMethods from "./HttpMethods";

export default class ExpressHttp implements Http {
    private readonly app: any;

    constructor(private readonly auth: Auth) {
        this.app = express();
        this.app.use(express.json({ limit: "2mb" }));
        this.app.use((req: any, res: any, next: any) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
            res.header("Access-Control-Allow-Headers", "Content-Type, access-token, X-File-Name");
            next();
        });
        const uploadDirectory = path.resolve(process.cwd(), "uploads");
        fs.mkdirSync(uploadDirectory, { recursive: true });
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

    async downloadRoute(url: string, authRequired: boolean): Promise<any> {
        const handlers: any[] = authRequired ? [this.auth.execute.bind(this.auth)] : [];
        handlers.push((req: any, res: any) => {
            const filename = path.basename(String(req.params.filename ?? ""));
            const filePath = path.resolve(process.cwd(), "uploads", filename);
            if (!filename || !fs.existsSync(filePath)) {
                return res.status(404).json({ message: "Arquivo não encontrado." });
            }
            return res.sendFile(filePath);
        });
        this.app.get(url, ...handlers);
    }

    async uploadRoute(url: string, authRequired: boolean, callback: any): Promise<any> {
        const handlers: any[] = authRequired ? [this.auth.execute.bind(this.auth)] : [];
        handlers.push(async (req: any, res: any) => {
            let storedPath: string | undefined;
            try {
                const originalName = decodeURIComponent(String(req.headers["x-file-name"] ?? "documento"));
                const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
                const extension = path.extname(safeName).slice(0, 10);
                const filename = `${randomUUID()}${extension}`;
                const uploadDirectory = path.resolve(process.cwd(), "uploads");
                fs.mkdirSync(uploadDirectory, { recursive: true });
                storedPath = path.join(uploadDirectory, filename);
                const maxBytes = 20 * 1024 * 1024;
                const chunks: Buffer[] = [];
                let size = 0;
                for await (const chunk of req) {
                    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    size += buffer.length;
                    if (size > maxBytes) {
                        res.status(413).json({ message: "O arquivo excede o limite de 20 MB." });
                        return;
                    }
                    chunks.push(buffer);
                }
                if (!size) {
                    res.status(422).json({ message: "Selecione um arquivo antes de enviar." });
                    return;
                }
                fs.writeFileSync(storedPath, Buffer.concat(chunks));
                const result = await callback(req.params, req.body ?? {}, {
                    originalName: safeName,
                    filename,
                    path: storedPath,
                    size,
                    mimeType: String(req.headers["content-type"] ?? "application/octet-stream"),
                    url: `${req.protocol}://${req.get("host")}/uploads/${filename}`,
                });
                res.json(result);
            } catch (exception: any) {
                if (storedPath && fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
                console.error(exception);
                if (!res.headersSent) res.status(422).json({ message: exception.message ?? "Não foi possível enviar o arquivo." });
            }
        });
        this.app.post(url, ...handlers);
    }

    swagger(specification: object): void {
        this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specification));
        this.app.get("/api-docs.json", (_req: any, res: any) => res.json(specification));
    }

    async listen(port: number): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const server = this.app.listen(port, () => resolve());
            server.once("error", reject);
        });
    }
}
