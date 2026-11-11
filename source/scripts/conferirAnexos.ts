import { config } from "dotenv";
import { promises as fs } from "fs";
import { Pool } from "pg";
import { stringConexao } from "../infra/database/stringConexao";
import { pastaDosAnexos } from "../infra/arquivos/ArmazenamentoAnexosDisco";
import { conferirAnexos, relatorioConferencia, TABELA_DO_DONO } from "../infra/arquivos/conferenciaAnexos";

config();

/**
 * Confere anexos órfãos e só relata (não apaga nada). Sai com código 1 se houver órfãos.
 * Na VPS: docker exec konvex-backend node dist/source/scripts/conferirAnexos.js
 */
async function main(): Promise<void> {
    const pool = new Pool({ connectionString: stringConexao() });
    try {
        const { rows } = await pool.query(
            `SELECT codigo::text, dono_tipo AS "donoTipo", dono_codigo::text AS "donoCodigo", nome, arquivo FROM anexos`,
        );
        const donos = new Set<string>();
        for (const [tipo, tabela] of Object.entries(TABELA_DO_DONO)) {
            const r = await pool.query(`SELECT codigo::text FROM ${tabela}`);
            r.rows.forEach((l) => donos.add(`${tipo}:${l.codigo}`));
        }
        const pasta = pastaDosAnexos();
        const arquivos = await fs.readdir(pasta).catch((e: any) => (e?.code === "ENOENT" ? [] : Promise.reject(e)));
        console.log(`Pasta dos anexos: ${pasta}`);
        const resultado = conferirAnexos(rows, arquivos, donos);
        console.log(relatorioConferencia(resultado));
        if (resultado.semArquivo.length || resultado.semDono.length || resultado.semRegistro.length) process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main().catch((erro) => {
    console.error(erro.message ?? erro);
    process.exitCode = 2;
});
