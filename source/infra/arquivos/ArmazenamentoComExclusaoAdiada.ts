import ArmazenamentoAnexosInterface from "../../domain/interfaces/ArmazenamentoAnexosInterface";

/**
 * Armazenamento usado dentro de uma transação do banco: salvar e ler vão direto ao disco, mas
 * excluir só anota o arquivo. Quem abriu a transação apaga os anotados depois do COMMIT; num
 * ROLLBACK eles ficam, junto com os registros que voltaram.
 */
export default class ArmazenamentoComExclusaoAdiada implements ArmazenamentoAnexosInterface {
    constructor(
        private readonly real: ArmazenamentoAnexosInterface,
        private readonly aExcluir: string[],
    ) {}

    // Grava no disco na hora: um ROLLBACK depois de salvar deixa o arquivo sobrando (o conferirAnexos acha).
    salvar(arquivo: string, conteudo: Buffer): Promise<void> {
        return this.real.salvar(arquivo, conteudo);
    }

    ler(arquivo: string): Promise<Buffer | null> {
        return this.real.ler(arquivo);
    }

    abrir(arquivo: string): Promise<{ fluxo: NodeJS.ReadableStream; tamanho: number } | null> {
        return this.real.abrir(arquivo);
    }

    async excluir(arquivo: string): Promise<void> {
        this.aExcluir.push(arquivo);
    }
}
