import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import EnvioEmailInterface, { EmailSaida } from "../../domain/interfaces/EnvioEmailInterface";

/**
 * Sem SMTP. Fora de produção escreve o e-mail no console (e, com `pasta`, em `emails.jsonl`, que o
 * e2e lê). Em produção escreve só destinatário e assunto (o corpo tem link de acesso) e falha.
 */
export default class EnvioEmailLog implements EnvioEmailInterface {
    constructor(
        private readonly producao: boolean,
        private readonly pasta?: string,
    ) {}

    async enviar(email: EmailSaida): Promise<void> {
        if (this.producao) {
            console.log(`[e-mail] não enviado (SMTP não configurado): para=${email.para} assunto=${email.assunto}`);
            throw new Error("Envio de e-mail não configurado (defina SMTP_HOST).");
        }
        console.log(`[e-mail] para=${email.para} assunto=${email.assunto}\n${email.texto}`);
        if (this.pasta) {
            mkdirSync(this.pasta, { recursive: true });
            const linha = JSON.stringify({ para: email.para, assunto: email.assunto, texto: email.texto, em: new Date().toISOString() });
            appendFileSync(join(this.pasta, "emails.jsonl"), linha + "\n");
        }
    }
}
