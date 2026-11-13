import express from "express";
import swaggerUi from "swagger-ui-express";
import Auth from "./middleware/Auth";
import Http, { OpcoesRota } from "./Http";
import RespostaArquivo from "./RespostaArquivo";
import HttpMethods from "./HttpMethods";
import { ErroAplicacao } from "../../shared/erros/ErroAplicacao";

/** Origens autorizadas a chamar a API pelo navegador (CORS_ORIGINS, separadas por vírgula). */
export function origensCors(): string[] {
    const configuradas = process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:4173";
    return configuradas
        .split(",")
        .map((origem) => origem.trim())
        .filter(Boolean);
}

/**
 * Converte exceções em respostas HTTP. Erros da aplicação usam o próprio status; o resto vira
 * 500 com mensagem genérica e o detalhe só no log (nada técnico chega à tela).
 */
export function responderErro(res: any, exception: any): void {
    if (exception instanceof ErroAplicacao) {
        res.status(exception.codigoHttp).json({ message: exception.message, codigo: exception.codigo });
        return;
    }
    // Erros do driver `pg` trazem o campo `severity`; é assim que são reconhecidos.
    if (exception && typeof exception === "object" && "severity" in exception) {
        // 22P02: texto que não serve para o tipo da coluna. Um código que não é UUID não existe
        // no banco, então responde 404, como os repositórios que comparam `codigo::text`.
        if (exception.code === "22P02") {
            const uuid = /type uuid/i.test(String(exception.message));
            res.status(uuid ? 404 : 400).json(
                uuid
                    ? { message: "Registro não encontrado.", codigo: "NAO_ENCONTRADO" }
                    : { message: "Algum valor informado não está no formato esperado.", codigo: "FORMATO_INVALIDO" },
            );
            return;
        }
        console.error(exception);
        res.status(500).json({ message: "Erro interno ao acessar o banco de dados." });
        return;
    }
    // Erro inesperado (bug ou `throw new Error` comum). Para 400/404/409, lance a classe certa
    // de shared/erros.
    console.error(exception);
    res.status(500).json({ message: "Erro interno. Tente de novo; se continuar, avise a gestão.", codigo: "ERRO_INTERNO" });
}

/**
 * Única classe que conhece o Express. As rotas falam com a interface Http, então trocar de
 * framework (ou subir um servidor de teste) não mexe nos módulos.
 */
export default class ExpressHttp implements Http {
    private readonly app: any;
    private server: any;

    constructor(private readonly auth: Auth) {
        this.app = express();
        // Atrás do Traefik, o IP real vem em X-Forwarded-For. Só se confia nesse cabeçalho quando a
        // conexão chega de rede local/privada (o Traefik na rede Docker); um cliente direto não o falsifica.
        this.app.set("trust proxy", process.env.TRUST_PROXY ?? "loopback, linklocal, uniquelocal");
        this.app.disable("x-powered-by");
        // A API só devolve JSON e downloads: nada dela deve ser aberto dentro de outra página nem
        // ter o tipo adivinhado pelo navegador (auditoria de 13/11/2026).
        this.app.use((_req: any, res: any, next: any) => {
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("X-Frame-Options", "DENY");
            res.setHeader("Referrer-Policy", "no-referrer");
            next();
        });
        // JSON pequeno de propósito; arquivos não passam por aqui, e sim por receberArquivo (até 20 MB).
        this.app.use(express.json({ limit: "2mb" }));
        const origensPermitidas = origensCors();
        // CORS feito à mão: só ecoa a origem se ela estiver na lista. Os cabeçalhos liberados incluem
        // `access-token` (autenticação) e `X-Nome-Arquivo` (nome do arquivo nos uploads).
        this.app.use((req: any, res: any, next: any) => {
            const origem = req.headers.origin;
            if (origem && origensPermitidas.includes(origem)) {
                res.header("Access-Control-Allow-Origin", origem);
                res.header("Vary", "Origin");
                res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
                res.header("Access-Control-Allow-Headers", "Content-Type, access-token, X-Nome-Arquivo");
            }
            next();
        });
        this.app.options("*", (_req: any, res: any) => res.end());
    }

    /** Lê o corpo como bytes (depois da autenticação, para não aceitar arquivo de quem não está logado). */
    private receberArquivo(opcoes: NonNullable<OpcoesRota["arquivo"]>) {
        const ler = express.raw({ type: () => true, limit: opcoes.limiteBytes });
        return (req: any, res: any, next: any) => {
            const user = req.body?.user;
            // O express.raw pula a leitura quando `_body` está marcado (marca que o express.json deixa
            // ao ler um corpo); zerar garante que os bytes do arquivo sejam lidos aqui.
            req._body = false;
            ler(req, res, (erro: any) => {
                if (erro) {
                    const grande = erro.type === "entity.too.large";
                    res.status(grande ? 413 : 400).json({
                        message: grande ? opcoes.mensagemLimite : "Não foi possível receber o arquivo.",
                        codigo: grande ? "ANEXO_GRANDE_DEMAIS" : "ANEXO_INVALIDO",
                    });
                    return;
                }
                let nome = "";
                try {
                    nome = decodeURIComponent(String(req.headers["x-nome-arquivo"] ?? ""));
                } catch {
                    nome = "";
                }
                const conteudo = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
                req.body = { user, arquivo: { nome, conteudo } };
                next();
            });
        };
    }

    private registerRoute(method: HttpMethods, url: string, callback: any, authRequired: boolean, opcoes?: OpcoesRota): void {
        const handlers = authRequired ? [this.auth.execute.bind(this.auth)] : [];
        if (opcoes?.arquivo) handlers.push(this.receberArquivo(opcoes.arquivo));
        handlers.push(async (req: any, res: any) => {
            try {
                const result = await callback(req.params, req.body, req.query, { ip: String(req.ip ?? "desconhecido") });
                if (result instanceof RespostaArquivo) {
                    // Sempre como download (attachment) e com nosniff: um arquivo enviado nunca é aberto
                    // pelo navegador como página do sistema. Sem cache, porque o conteúdo depende de permissão.
                    res.setHeader("Content-Type", result.tipoMime);
                    res.setHeader("Content-Length", String(result.conteudo.length));
                    res.setHeader("X-Content-Type-Options", "nosniff");
                    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(result.nome)}`);
                    res.setHeader("Cache-Control", "private, no-store");
                    res.end(result.conteudo);
                    return;
                }
                res.json(result === undefined ? { message: "Operação realizada com sucesso." } : result);
            } catch (exception: any) {
                responderErro(res, exception);
            }
        });
        this.app[method](url, ...handlers);
    }

    async route(method: HttpMethods, url: string, auth: boolean, callback: any, opcoes?: OpcoesRota): Promise<any> {
        this.registerRoute(method, url, callback, auth, opcoes);
    }

    swagger(specification: object): void {
        // Em produção, a documentação só fica pública se SWAGGER_ENABLED=true.
        const habilitado = process.env.SWAGGER_ENABLED ? process.env.SWAGGER_ENABLED === "true" : process.env.NODE_ENV !== "production";
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
