import { ErroValidacao } from "./erros/ErroValidacao";

/** Normaliza texto para busca: minúsculas, sem acentos e sem espaços nas pontas. */
export function normalizarBusca(texto: string | null | undefined): string {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
}

/** Transforma um nome em código: "Sênior Plus" -> "senior_plus". */
export function slug(texto: string | null | undefined): string {
    return normalizarBusca(texto)
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 20);
}

/** Tags em minúsculas, sem "#", sem repetição. */
export function normalizarTags(tags: unknown[] = []): string[] {
    const limpas = tags
        .map((t) =>
            String(t ?? "")
                .trim()
                .replace(/^#+/, "")
                .toLowerCase(),
        )
        .filter(Boolean);
    return [...new Set(limpas)];
}

/** Aceita só endereços http: ou https:; devolve o próprio link ou lança ErroValidacao. */
export function validarLink(link: string): string {
    let valido = false;
    try {
        valido = ["http:", "https:"].includes(new URL(link).protocol);
    } catch {
        valido = false;
    }
    if (!valido) {
        throw new ErroValidacao(`Link inválido: ${link}. Use um endereço começando com https://.`, "LINK_INVALIDO");
    }
    return link;
}
