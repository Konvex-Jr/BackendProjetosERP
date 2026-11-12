import ArmazenamentoAnexosInterface from "../../domain/interfaces/ArmazenamentoAnexosInterface";

export default class ArmazenamentoAnexosMemoria implements ArmazenamentoAnexosInterface {
    readonly arquivos = new Map<string, Buffer>();

    async salvar(arquivo: string, conteudo: Buffer): Promise<void> {
        this.arquivos.set(arquivo, Buffer.from(conteudo));
    }

    async ler(arquivo: string): Promise<Buffer | null> {
        return this.arquivos.get(arquivo) ?? null;
    }

    async excluir(arquivo: string): Promise<void> {
        this.arquivos.delete(arquivo);
    }
}
