/** Onde ficam os arquivos WebP das fotos de perfil (disco na VPS; memória nos testes). */
export default interface ArmazenamentoFotosInterface {
    /** Nome inválido lança `ErroValidacao`; foto gravada nunca é sobrescrita. */
    salvar(arquivo: string, conteudo: Buffer): Promise<void>;
    /** `null` se o nome é inválido ou o arquivo não existe. */
    abrir(arquivo: string): Promise<{ fluxo: NodeJS.ReadableStream; tamanho: number } | null>;
    /** Não falha se o arquivo já não existir; nome inválido lança `ErroValidacao`. */
    excluir(arquivo: string): Promise<void>;
}
