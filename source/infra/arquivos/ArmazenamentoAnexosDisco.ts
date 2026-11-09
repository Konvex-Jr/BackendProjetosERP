import { promises as fs } from "fs";
import path from "path";
import ArmazenamentoAnexosInterface from "../../domain/Interfaces/ArmazenamentoAnexosInterface";

/** Pasta dos anexos: ANEXOS_DIR (na VPS, um volume que entra no backup) ou ./anexos. */
export function pastaDosAnexos(): string {
    return path.resolve(process.env.ANEXOS_DIR || "anexos");
}

export default class ArmazenamentoAnexosDisco implements ArmazenamentoAnexosInterface {
    constructor(private readonly pasta: string = pastaDosAnexos()) {}

    /** O nome no disco é sempre um UUID gerado pela API; qualquer outra coisa é recusada. */
    private caminho(arquivo: string): string {
        if (!/^[0-9a-f-]{36}$/i.test(arquivo)) throw new Error("Nome de arquivo inválido.");
        return path.join(this.pasta, arquivo);
    }

    async salvar(arquivo: string, conteudo: Buffer): Promise<void> {
        await fs.mkdir(this.pasta, { recursive: true });
        await fs.writeFile(this.caminho(arquivo), conteudo, { flag: "wx" });
    }

    async ler(arquivo: string): Promise<Buffer | null> {
        try {
            return await fs.readFile(this.caminho(arquivo));
        } catch (erro: any) {
            if (erro?.code === "ENOENT") return null;
            throw erro;
        }
    }

    async excluir(arquivo: string): Promise<void> {
        await fs.rm(this.caminho(arquivo), { force: true });
    }
}
