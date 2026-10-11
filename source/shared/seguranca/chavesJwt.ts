import { readFileSync } from "fs";

function carregarChave(valor: string | undefined, caminho: string, nome: string): string | Buffer {
    if (valor?.trim()) {
        return valor.replace(/\\n/g, "\n");
    }

    const caminhoConfigurado = process.env[caminho] || (nome === "privada" ? "./private.key" : "./public.key");
    try {
        return readFileSync(caminhoConfigurado);
    } catch {
        throw new Error(
            `Chave JWT ${nome} não encontrada. Configure ${nome === "privada" ? "JWT_PRIVATE_KEY/JWT_PRIVATE_KEY_PATH" : "JWT_PUBLIC_KEY/JWT_PUBLIC_KEY_PATH"} ou gere os arquivos private.key e public.key.`,
        );
    }
}

export function obterChavePrivada(): string | Buffer {
    return carregarChave(process.env.JWT_PRIVATE_KEY, "JWT_PRIVATE_KEY_PATH", "privada");
}

export function obterChavePublica(): string | Buffer {
    return carregarChave(process.env.JWT_PUBLIC_KEY, "JWT_PUBLIC_KEY_PATH", "pública");
}
