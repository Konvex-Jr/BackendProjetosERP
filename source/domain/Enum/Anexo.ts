/**
 * Anexos (sessão 12c, decisões de 09/11/2026): até 20 MB por arquivo; documentos e imagens.
 * O tipo do arquivo é decidido pela extensão (não pelo que o navegador diz), e a API
 * devolve sempre o tipo desta lista, para o arquivo nunca ser servido como página.
 */
export enum DonoAnexo {
    DOCUMENTO = "documento",
    CONHECIMENTO = "conhecimento",
    INICIATIVA = "iniciativa",
}

export const LIMITE_ANEXO_BYTES = 20 * 1024 * 1024;

export const TIPOS_ANEXO: Readonly<Record<string, string>> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    zip: "application/zip",
};

export const EXTENSOES_ANEXO = Object.keys(TIPOS_ANEXO);

/** Extensão em minúsculas (sem o ponto) ou "" se o nome não tiver. */
export function extensaoDe(nome: string): string {
    const m = /\.([A-Za-z0-9]{1,5})$/.exec(nome.trim());
    return m ? m[1].toLowerCase() : "";
}
