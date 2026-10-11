import { Pool, PoolClient, types } from "pg";
import ConexaoBanco from "./ConexaoBanco";

types.setTypeParser(1082, (valor: string) => new Date(`${valor}T00:00:00.000Z`));
types.setTypeParser(1700, (valor: string) => Number(valor));

export default class PgConexao implements ConexaoBanco {
    private readonly executor: Pool | PoolClient;
    private readonly emTransacao: boolean;

    constructor(executor: Pool | PoolClient, emTransacao: boolean = false) {
        this.executor = executor;
        this.emTransacao = emTransacao;
    }

    static criar(stringConexao: string): PgConexao {
        return new PgConexao(new Pool({ connectionString: stringConexao }));
    }

    async consultar<T = any>(sql: string, parametros: unknown[] = []): Promise<T[]> {
        const resultado = await this.executor.query(sql, parametros as any[]);
        return resultado.rows as T[];
    }

    async transacao<T>(operacao: (conexao: ConexaoBanco) => Promise<T>): Promise<T> {
        if (this.emTransacao) {
            return operacao(this);
        }

        const cliente = await (this.executor as Pool).connect();

        try {
            await cliente.query("BEGIN");
            const resultado = await operacao(new PgConexao(cliente, true));
            await cliente.query("COMMIT");
            return resultado;
        } catch (erro) {
            await cliente.query("ROLLBACK");
            throw erro;
        } finally {
            cliente.release();
        }
    }

    async encerrar(): Promise<void> {
        if (this.emTransacao) {
            return;
        }

        await (this.executor as Pool).end();
    }
}
