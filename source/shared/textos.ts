/** Minúsculas e sem acentos: "Reunião" -> "reuniao". Usado na busca da Biblioteca. */
export function semAcento(texto: string): string {
    return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
