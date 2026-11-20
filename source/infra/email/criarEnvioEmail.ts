import EnvioEmailInterface from "../../domain/interfaces/EnvioEmailInterface";
import EnvioEmailLog from "./EnvioEmailLog";
import EnvioEmailSmtp from "./EnvioEmailSmtp";

/** `SMTP_HOST` definido → SMTP; senão → log (que falha em produção). */
export default function criarEnvioEmail(env: NodeJS.ProcessEnv = process.env): EnvioEmailInterface {
    if (env.SMTP_HOST) {
        return new EnvioEmailSmtp({
            host: env.SMTP_HOST,
            porta: Number(env.SMTP_PORTA) || 587,
            usuario: env.SMTP_USUARIO || undefined,
            senha: env.SMTP_SENHA || undefined,
            de: env.EMAIL_REMETENTE || "Konvex Jr <nao-responda@konvexjr.com.br>",
        });
    }
    return new EnvioEmailLog(env.NODE_ENV === "production", env.EMAIL_PASTA_DEV || undefined);
}
