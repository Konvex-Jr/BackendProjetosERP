/** Resposta de rota que devolve um arquivo para baixar, em vez de JSON (sessão 12c). */
export default class RespostaArquivo {
    constructor(
        readonly nome: string,
        readonly tipoMime: string,
        readonly conteudo: Buffer | NodeJS.ReadableStream,
        /** Bytes do arquivo; vira o Content-Length (o fluxo não sabe o próprio tamanho). */
        readonly tamanho: number,
    ) {}
}
