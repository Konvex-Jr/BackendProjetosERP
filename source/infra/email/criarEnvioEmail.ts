import EnvioEmailInterface from "../../domain/interfaces/EnvioEmailInterface";
import EnvioEmailLog from "./EnvioEmailLog";
import EnvioEmailSmtp from "./EnvioEmailSmtp";

/** Nome do servidor no EHLO: `SMTP_NOME` ou o domínio do `APP_URL`. */
export function nomeEhlo(env: NodeJS.ProcessEnv): string | undefined {
    if (env.SMTP_NOME?.trim()) return env.SMTP_NOME.trim();
    try {
        return env.APP_URL ? new URL(env.APP_URL).hostname || undefined : undefined;
    } catch {
        return undefined;
    }
}

/** `SMTP_HOST` definido → SMTP; senão → log (que falha em produção). */
export default function criarEnvioEmail(env: NodeJS.ProcessEnv = process.env): EnvioEmailInterface {
    if (env.SMTP_HOST) {
        return new EnvioEmailSmtp({
            host: env.SMTP_HOST,
            porta: Number(env.SMTP_PORTA) || 587,
            usuario: env.SMTP_USUARIO || undefined,
            senha: env.SMTP_SENHA || undefined,
            nome: nomeEhlo(env),
            de: env.EMAIL_REMETENTE || "Konvex Jr <nao-responda@konvexjr.com.br>",
        });
    }
    return new EnvioEmailLog(env.NODE_ENV === "production", env.EMAIL_PASTA_DEV || undefined);
}
