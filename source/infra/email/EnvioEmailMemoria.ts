import EnvioEmailInterface, { EmailSaida } from "../../domain/interfaces/EnvioEmailInterface";

/** Para os testes: guarda o que seria enviado. */
export default class EnvioEmailMemoria implements EnvioEmailInterface {
    readonly enviados: EmailSaida[] = [];
    falhar = false;

    async enviar(email: EmailSaida): Promise<void> {
        if (this.falhar) throw new Error("Falha simulada no envio de e-mail.");
        this.enviados.push(email);
    }

    /** Token do link de senha no último e-mail enviado para a pessoa (`/#/senha/<token>`). */
    ultimoLink(para: string): string | null {
        for (let i = this.enviados.length - 1; i >= 0; i--) {
            if (this.enviados[i].para !== para) continue;
            return /\/#\/senha\/([^\s"'<>]+)/.exec(this.enviados[i].texto)?.[1] ?? null;
        }
        return null;
    }
}
