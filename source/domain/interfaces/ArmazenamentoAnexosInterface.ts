/** Onde ficam os bytes dos anexos (disco na VPS; memória nos testes). */
export default interface ArmazenamentoAnexosInterface {
    salvar(arquivo: string, conteudo: Buffer): Promise<void>;
    ler(arquivo: string): Promise<Buffer | null>;
    /** Abre o arquivo para enviar em fluxo, sem ler tudo para a memória. `null` se o arquivo não existe. */
    abrir(arquivo: string): Promise<{ fluxo: NodeJS.ReadableStream; tamanho: number } | null>;
    /** Não falha se o arquivo já não existir. */
    excluir(arquivo: string): Promise<void>;
}
