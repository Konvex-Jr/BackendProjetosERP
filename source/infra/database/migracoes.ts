import fs from "fs";
import path from "path";
import { Pool } from "pg";

/**
 * Aplica, em ordem, os arquivos .sql da pasta migrations/ que ainda não foram aplicados.
 * Cada arquivo roda numa transação; o registro fica na tabela schema_migrations.
 * Um advisory lock impede duas instâncias de migrarem ao mesmo tempo.
 *
 * O controle é pelo nome do arquivo: migração já aplicada nunca roda de novo, então editar
 * um arquivo antigo não muda o banco. Para alterar o esquema, crie o próximo número.
 * Quem chama é scripts/migrar.ts, antes de subir a API (ver o CMD do Dockerfile).
 */
export async function aplicarMigracoes(
    pool: Pool,
    pasta: string = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "migrations"),
    log: (mensagem: string) => void = console.log,
): Promise<string[]> {
    const arquivos = fs
        .readdirSync(pasta)
        .filter((arquivo) => /^\d{3}_.+\.sql$/.test(arquivo))
        .sort();

    const cliente = await pool.connect();
    const aplicadasAgora: string[] = [];
    try {
        // Número fixo e arbitrário; só precisa ser o mesmo no lock e no unlock.
        await cliente.query("SELECT pg_advisory_lock(727001)");
        await cliente.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                nome TEXT PRIMARY KEY,
                aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);
        const { rows } = await cliente.query<{ nome: string }>("SELECT nome FROM schema_migrations");
        const jaAplicadas = new Set(rows.map((linha) => linha.nome));

        for (const arquivo of arquivos) {
            if (jaAplicadas.has(arquivo)) continue;
            const sql = fs.readFileSync(path.join(pasta, arquivo), "utf8");
            try {
                await cliente.query("BEGIN");
                await cliente.query(sql);
                await cliente.query("INSERT INTO schema_migrations (nome) VALUES ($1)", [arquivo]);
                await cliente.query("COMMIT");
            } catch (erro: any) {
                await cliente.query("ROLLBACK");
                throw new Error(`Falha ao aplicar a migração ${arquivo}: ${erro.message}`);
            }
            aplicadasAgora.push(arquivo);
            log(`Migração aplicada: ${arquivo}`);
        }
        if (aplicadasAgora.length === 0) log("Banco já está atualizado.");
        return aplicadasAgora;
    } finally {
        await cliente.query("SELECT pg_advisory_unlock(727001)").catch(() => undefined);
        cliente.release();
    }
}
