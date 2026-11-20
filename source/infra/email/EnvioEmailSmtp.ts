import { createTransport, Transporter } from "nodemailer";
import EnvioEmailInterface, { EmailSaida } from "../../domain/interfaces/EnvioEmailInterface";

export interface ConfiguracaoSmtp {
    host: string;
    porta: number;
    usuario?: string;
    senha?: string;
    de: string;
}

export default class EnvioEmailSmtp implements EnvioEmailInterface {
    private readonly transporte: Transporter;

    constructor(private readonly config: ConfiguracaoSmtp) {
        this.transporte = createTransport({
            host: config.host,
            port: config.porta,
            secure: config.porta === 465,
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
