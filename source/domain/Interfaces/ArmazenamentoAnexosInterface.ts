/** Onde ficam os bytes dos anexos (disco na VPS; memória nos testes). */
export default interface ArmazenamentoAnexosInterface {
    salvar(arquivo: string, conteudo: Buffer): Promise<void>;
    ler(arquivo: string): Promise<Buffer | null>;
    /** Não falha se o arquivo já não existir. */
    excluir(arquivo: string): Promise<void>;
}
