import { promises as fs } from "fs";
import type { FileHandle } from "fs/promises";
import path from "path";
import ArmazenamentoFotosInterface from "../../domain/interfaces/ArmazenamentoFotosInterface";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { pastaDosAnexos } from "./ArmazenamentoAnexosDisco";
import { NOME_FOTO } from "../../shared/foto";

/** Pasta das fotos: uma subpasta dentro da pasta dos anexos (entra no mesmo backup). */
export function pastaDasFotos(): string {
    return path.join(pastaDosAnexos(), "fotos");
}

/** Fotos no disco, uma por arquivo, com `<uuid>.webp` como nome gerado pela API. */
export default class ArmazenamentoFotosDisco implements ArmazenamentoFotosInterface {
    constructor(private readonly pasta: string = pastaDasFotos()) {}

    private caminho(arquivo: string): string {
        if (!NOME_FOTO.test(arquivo)) throw new ErroValidacao(MENSAGENS_DE_ERRO.FOTO.NOME_INVALIDO, "FOTO_NOME_INVALIDO");
        return path.join(this.pasta, arquivo);
    }

    async salvar(arquivo: string, conteudo: Buffer): Promise<void> {
        const caminho = this.caminho(arquivo);
        await fs.mkdir(this.pasta, { recursive: true });
        // "wx": falha se o arquivo já existir; uma foto gravada nunca é sobrescrita.
        await fs.writeFile(caminho, conteudo, { flag: "wx" });
    }

    async abrir(arquivo: string): Promise<{ fluxo: NodeJS.ReadableStream; tamanho: number } | null> {
        if (!NOME_FOTO.test(arquivo)) return null;
        let handle: FileHandle;
        try {
            handle = await fs.open(path.join(this.pasta, arquivo), "r");
        } catch (erro: any) {
            if (erro?.code === "ENOENT") return null;
            throw erro;
        }
        try {
            const { size } = await handle.stat();
            return { fluxo: handle.createReadStream(), tamanho: size };
        } catch (erro) {
            await handle.close().catch(() => undefined);
            throw erro;
        }
    }

    async excluir(arquivo: string): Promise<void> {
        await fs.rm(this.caminho(arquivo), { force: true });
    }
}
