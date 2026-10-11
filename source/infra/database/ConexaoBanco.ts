export default interface ConexaoBanco {
    consultar<T = any>(sql: string, parametros?: unknown[]): Promise<T[]>;
    transacao<T>(operacao: (conexao: ConexaoBanco) => Promise<T>): Promise<T>;
    encerrar(): Promise<void>;
}
