export default interface EnviarDocumentoInput {
    codigoPasta: string;
    nome: string;
    tamanhoBytes: number;
    dataEnvio?: Date;
    codigoAutor: string;
    arquivoUrl: string;
    extensao?: string | null;
}
