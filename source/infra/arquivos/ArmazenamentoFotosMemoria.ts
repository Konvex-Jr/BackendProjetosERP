import { Readable } from "stream";
import ArmazenamentoFotosInterface from "../../domain/interfaces/ArmazenamentoFotosInterface";

/** Versão em memória, para os testes. Guarda uma cópia dos bytes, como o disco faria. */
export default class ArmazenamentoFotosMemoria implements ArmazenamentoFotosInterface {
    readonly arquivos = new Map<string, Buffer>();

    async salvar(arquivo: string, conteudo: Buffer): Promise<void> {
        this.arquivos.set(arquivo, Buffer.from(conteudo));
    }

    async abrir(arquivo: string): Promise<{ fluxo: NodeJS.ReadableStream; tamanho: number } | null> {
        const conteudo = this.arquivos.get(arquivo);
        return conteudo ? { fluxo: Readable.from([conteudo]), tamanho: conteudo.length } : null;
    }

    async excluir(arquivo: string): Promise<void> {
        this.arquivos.delete(arquivo);
    }
}
