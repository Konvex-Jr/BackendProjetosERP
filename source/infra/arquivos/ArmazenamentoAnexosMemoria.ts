import { Readable } from "stream";
import ArmazenamentoAnexosInterface from "../../domain/interfaces/ArmazenamentoAnexosInterface";

/** Versão em memória, para os testes. Guarda uma cópia dos bytes, como o disco faria. */
export default class ArmazenamentoAnexosMemoria implements ArmazenamentoAnexosInterface {
    readonly arquivos = new Map<string, Buffer>();

    async salvar(arquivo: string, conteudo: Buffer): Promise<void> {
        this.arquivos.set(arquivo, Buffer.from(conteudo));
    }

    async ler(arquivo: string): Promise<Buffer | null> {
        return this.arquivos.get(arquivo) ?? null;
    }

    async abrir(arquivo: string): Promise<{ fluxo: NodeJS.ReadableStream; tamanho: number } | null> {
        const conteudo = this.arquivos.get(arquivo);
        return conteudo ? { fluxo: Readable.from([conteudo]), tamanho: conteudo.length } : null;
    }

    async excluir(arquivo: string): Promise<void> {
        this.arquivos.delete(arquivo);
    }
}
