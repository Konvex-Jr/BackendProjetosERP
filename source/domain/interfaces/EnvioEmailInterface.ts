export interface EmailSaida {
    para: string;
    assunto: string;
    texto: string;
    html: string;
}

export default interface EnvioEmailInterface {
    /** Lança quando o envio falha (quem chama decide se a falha aparece para a pessoa). */
    enviar(email: EmailSaida): Promise<void>;
}
