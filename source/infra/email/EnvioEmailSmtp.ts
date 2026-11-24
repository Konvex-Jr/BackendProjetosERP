import { createTransport, Transporter } from "nodemailer";
import EnvioEmailInterface, { EmailSaida } from "../../domain/interfaces/EnvioEmailInterface";

export interface ConfiguracaoSmtp {
    host: string;
    porta: number;
    usuario?: string;
    senha?: string;
    /** Nome no EHLO. O relay do Google recusa (421) o nome do container. */
    nome?: string;
    de: string;
}

export default class EnvioEmailSmtp implements EnvioEmailInterface {
    private readonly transporte: Transporter;

    constructor(private readonly config: ConfiguracaoSmtp) {
        this.transporte = createTransport({
            host: config.host,
            name: config.nome,
            port: config.porta,
            secure: config.porta === 465,
            requireTLS: config.porta !== 465,
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 10_000,
            auth: config.usuario ? { user: config.usuario, pass: config.senha ?? "" } : undefined,
        });
    }

    async enviar(email: EmailSaida): Promise<void> {
        await this.transporte.sendMail({
            from: this.config.de,
            to: email.para,
            subject: email.assunto,
            text: email.texto,
            html: email.html,
        });
    }
}
