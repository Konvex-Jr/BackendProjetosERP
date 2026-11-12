import { Pool, PoolClient, types } from "pg";
import ConexaoBanco from "./ConexaoBanco";

// 1082 = DATE. Por padrão o `pg` cria a data à meia-noite do fuso do processo (em São Paulo,
// 03:00 UTC) e a API devolveria o dia deslocado. Aqui vira meia-noite UTC, o mesmo formato de
// lerData (shared/entradas.ts). Por isso o CI roda a integração também com TZ=America/Sao_Paulo:
// com o processo em UTC, esse tipo de erro não aparece.
types.setTypeParser(1082, (valor: string) => new Date(`${valor}T00:00:00.000Z`));
// 1700 = NUMERIC. O `pg` devolve texto para não perder precisão; os valores do sistema
// (valor-hora, alocação, médias) cabem com folga num number.
types.setTypeParser(1700, (valor: string) => Number(valor));

/**
 * ConexaoBanco com o `pg`. Fora de transação usa o Pool (cada consulta pega um cliente livre);
 * dentro, um cliente fixo, porque BEGIN, as consultas e COMMIT precisam ir pela mesma conexão.
 */
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
        // Já dentro de uma transação: reaproveita a mesma (não há transação aninhada).
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
        // A conexão da transação só empresta um cliente; quem fecha o pool é a conexão principal.
        if (this.emTransacao) {
            return;
        }

        await (this.executor as Pool).end();
    }
}
