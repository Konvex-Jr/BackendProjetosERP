/**
 * O que os repositórios precisam do banco (implementado por PgConexao). `consultar` sempre usa
 * parâmetros ($1, $2...), nunca texto concatenado. `transacao` roda a operação num único
 * BEGIN/COMMIT e faz ROLLBACK se ela lançar erro.
 */
export default interface ConexaoBanco {
    consultar<T = any>(sql: string, parametros?: unknown[]): Promise<T[]>;
    transacao<T>(operacao: (conexao: ConexaoBanco) => Promise<T>): Promise<T>;
    encerrar(): Promise<void>;
}
