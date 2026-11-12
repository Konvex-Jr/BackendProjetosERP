import { readFileSync } from "fs";

/**
 * Chaves do JWT RS256: a privada assina os tokens (emitirSessao) e a pública confere (AuthExpress).
 * Com par de chaves, quem só verifica nunca precisa conhecer a chave que assina.
 *
 * Ordem de busca: conteúdo na variável (JWT_PRIVATE_KEY / JWT_PUBLIC_KEY), depois o caminho
 * em *_PATH, por fim ./private.key e ./public.key (gerados por `npm run keys`).
 */
function carregarChave(valor: string | undefined, caminho: string, nome: string): string | Buffer {
    if (valor?.trim()) {
        // Em .env e painéis de deploy a chave PEM costuma vir numa linha só, com "\n" literal.
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
