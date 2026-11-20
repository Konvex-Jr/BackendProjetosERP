import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import EnvioEmailLog from "../source/infra/email/EnvioEmailLog";
import EnvioEmailMemoria from "../source/infra/email/EnvioEmailMemoria";
import { emailConvite, emailRedefinir, emailSenhaAlterada, linkSenha } from "../source/useCases/auth/textosEmail";

const email = { para: "ana@dev.konvex", assunto: "Assunto", texto: "corpo secreto https://x/#/senha/abc123", html: "<p>x</p>" };

describe("envio de e-mail", () => {
    afterEach(() => jest.restoreAllMocks());

    it("log fora de produção grava a linha na pasta", async () => {
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        const pasta = mkdtempSync(join(tmpdir(), "emails-"));
        await new EnvioEmailLog(false, pasta).enviar(email);
        const linha = JSON.parse(readFileSync(join(pasta, "emails.jsonl"), "utf8").trim());
        expect(linha).toMatchObject({ para: email.para, assunto: email.assunto, texto: email.texto });
        expect(typeof linha.em).toBe("string");
    });

    it("log em produção lança e não escreve o corpo", async () => {
        const espia = jest.spyOn(console, "log").mockImplementation(() => undefined);
        await expect(new EnvioEmailLog(true).enviar(email)).rejects.toThrow();
        const escrito = espia.mock.calls.flat().join(" ");
        expect(escrito).toContain(email.para);
        expect(escrito).toContain(email.assunto);
        expect(escrito).not.toContain("corpo secreto");
        expect(escrito).not.toContain("abc123");
    });

    it("memória acha o token do último link e falha quando pedido", async () => {
        const memoria = new EnvioEmailMemoria();
        await memoria.enviar({ ...email, texto: "x http://localhost:5173/#/senha/velho" });
        await memoria.enviar({ ...email, texto: "x http://localhost:5173/#/senha/novo\nfim" });
        expect(memoria.ultimoLink(email.para)).toBe("novo");
        expect(memoria.ultimoLink("outra@dev.konvex")).toBeNull();
        memoria.falhar = true;
        await expect(memoria.enviar(email)).rejects.toThrow();
        expect(memoria.enviados).toHaveLength(2);
    });

    it("textos trazem o link no texto e no HTML", () => {
        const link = linkSenha("tok");
        expect(link).toBe("http://localhost:5173/#/senha/tok");
        for (const t of [emailConvite("Ana", link), emailRedefinir("Ana", link)]) {
            expect(t.texto).toContain(link);
            expect(t.html).toContain(link);
        }
        expect(emailConvite("Ana", link).assunto).toBe("Seu acesso ao sistema da Konvex");
        expect(emailRedefinir("Ana", link).assunto).toBe("Redefinir sua senha");
        const alterada = emailSenhaAlterada("Ana");
        expect(alterada.assunto).toBe("Sua senha foi alterada");
        expect(alterada.texto).toContain("Se não foi você, fale com a gestão.");
    });

    it("APP_URL perde a barra final", () => {
        process.env.APP_URL = "https://erp.exemplo.com/";
        try {
            expect(linkSenha("t")).toBe("https://erp.exemplo.com/#/senha/t");
        } finally {
            delete process.env.APP_URL;
        }
    });
});
