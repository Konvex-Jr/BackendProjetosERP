import { EmailSaida } from "../../domain/interfaces/EnvioEmailInterface";

type Texto = Omit<EmailSaida, "para">;

/** Link da tela de definir senha (`APP_URL` sem barra final). */
export function linkSenha(token: string): string {
    const base = (process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "");
    return `${base}/#/senha/${token}`;
}

function escapar(texto: string): string {
    return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function moldura(titulo: string, paragrafos: string[], botao?: { texto: string; link: string }): string {
    const corpo = paragrafos.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0b1f3a">${p}</p>`).join("");
    const cta = botao
        ? `<p style="margin:20px 0"><a href="${escapar(botao.link)}" style="background:#f7931e;color:#0b1f3a;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">${botao.texto}</a></p>`
        : "";
    return `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px"><h1 style="margin:0 0 18px;font-size:20px;color:#0b1f3a">${titulo}</h1>${corpo}${cta}<p style="margin:24px 0 0;font-size:12px;color:#5b6b82">Konvex Jr</p></div>`;
}

export function emailConvite(nome: string, link: string): Texto {
    const n = escapar(nome);
    return {
        assunto: "Seu acesso ao sistema da Konvex",
        texto: `Olá, ${nome}.\n\nSua conta no sistema da Konvex foi criada. Defina sua senha pelo link abaixo (vale por 72 horas e só pode ser usado uma vez):\n\n${link}\n\nSe você não esperava este e-mail, ignore-o.`,
        html: moldura(
            "Seu acesso ao sistema da Konvex",
            [
                `Olá, ${n}.`,
                "Sua conta no sistema da Konvex foi criada. Defina sua senha pelo botão abaixo (vale por 72 horas e só pode ser usado uma vez).",
                "Se você não esperava este e-mail, ignore-o.",
            ],
            { texto: "Definir minha senha", link },
        ),
    };
}

export function emailRedefinir(nome: string, link: string): Texto {
    const n = escapar(nome);
    return {
        assunto: "Redefinir sua senha",
        texto: `Olá, ${nome}.\n\nRecebemos um pedido para redefinir sua senha. Use o link abaixo (vale por 1 hora e só pode ser usado uma vez):\n\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
        html: moldura(
            "Redefinir sua senha",
            [
                `Olá, ${n}.`,
                "Recebemos um pedido para redefinir sua senha. O link vale por 1 hora e só pode ser usado uma vez.",
                "Se não foi você, ignore este e-mail: sua senha continua a mesma.",
            ],
            { texto: "Redefinir senha", link },
        ),
    };
}

export function emailSenhaAlterada(nome: string): Texto {
    const n = escapar(nome);
    return {
        assunto: "Sua senha foi alterada",
        texto: `Olá, ${nome}.\n\nA senha da sua conta no sistema da Konvex foi alterada. Se não foi você, fale com a gestão.`,
        html: moldura("Sua senha foi alterada", [
            `Olá, ${n}.`,
            "A senha da sua conta no sistema da Konvex foi alterada.",
            "Se não foi você, fale com a gestão.",
        ]),
    };
}
