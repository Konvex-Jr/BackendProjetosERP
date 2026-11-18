import sharp from "sharp";

/** Nome da foto no disco e no banco: UUID v4 minúsculo + .webp. */
export const NOME_FOTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/** Lado da foto gravada, em pixels. */
export const LADO_FOTO = 256;

// Imagens maiores que isso nem são decodificadas (imagem pequena no disco que explode na memória).
const MAXIMO_PIXELS_ENTRADA = 4096 * 4096;

/** Formato pela assinatura do arquivo; só JPEG, PNG e WebP passam (nada de SVG, TIFF etc. no decodificador). */
export function formatoDaFoto(conteudo: Buffer): "jpeg" | "png" | "webp" | null {
    if (conteudo.length >= 3 && conteudo[0] === 0xff && conteudo[1] === 0xd8 && conteudo[2] === 0xff) return "jpeg";
    if (conteudo.length >= 8 && conteudo.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
    if (conteudo.length >= 12 && conteudo.toString("latin1", 0, 4) === "RIFF" && conteudo.toString("latin1", 8, 12) === "WEBP")
        return "webp";
    return null;
}

/**
 * Regrava a foto como WebP 256x256 (recorte central, se não vier quadrada). O navegador já manda
 * recortada; aqui ela é decodificada e gerada de novo, o que tira metadados (GPS da câmera) e
 * garante WebP mesmo do Safari, que não gera WebP pelo canvas. Lança se não decodificar.
 */
export async function converterFoto(conteudo: Buffer): Promise<Buffer> {
    return sharp(conteudo, { limitInputPixels: MAXIMO_PIXELS_ENTRADA, failOn: "error" })
        .rotate()
        .resize(LADO_FOTO, LADO_FOTO, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer();
}
