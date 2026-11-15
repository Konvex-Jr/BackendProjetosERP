import { config } from "dotenv";
import { promises as fs } from "fs";
import { Pool } from "pg";
import { stringConexao } from "../infra/database/stringConexao";
import { pastaDosAnexos } from "../infra/arquivos/ArmazenamentoAnexosDisco";
import { apagarSemRegistro, conferirAnexos, relatorioConferencia, TABELA_DO_DONO } from "../infra/arquivos/conferenciaAnexos";

config();

/**
 * Sem flag, só relata; com --apagar-sem-registro apaga os arquivos sem registro.
 * Confere anexos órfãos e sai com código 1 se sobrar algum.
 * Na VPS: docker exec konvex-backend node dist/source/scripts/conferirAnexos.js
 *
 * Com --apagar-sem-registro (sessão 17, depois da migração 012 e do backup): apaga do disco
 * só os arquivos "sem registro" (nome de anexo, dentro da pasta dos anexos, modificados há
 * mais de 10 minutos) e diz quantos. Registros sem arquivo e anexos sem dono continuam só
 * no relatório.
 */
async function main(): Promise<void> {
    const pool = new Pool({ connectionString: stringConexao() });
    try {
        // A pasta é lida ANTES dos registros: o upload grava o arquivo e depois o registro, então
        // um arquivo listado aqui cujo registro chegue logo depois aparece nos registros abaixo.
        const pasta = pastaDosAnexos();
        const arquivos = await fs.readdir(pasta).catch((e: any) => (e?.code === "ENOENT" ? [] : Promise.reject(e)));
        const { rows } = await pool.query(
            `SELECT codigo::text, dono_tipo AS "donoTipo", dono_codigo::text AS "donoCodigo", nome, arquivo FROM anexos`,
        );
        const donos = new Set<string>();
        for (const [tipo, tabela] of Object.entries(TABELA_DO_DONO)) {
            const r = await pool.query(`SELECT codigo::text FROM ${tabela}`);
            r.rows.forEach((l) => donos.add(`${tipo}:${l.codigo}`));
        }
        console.log(`Pasta dos anexos: ${pasta}`);
        const resultado = conferirAnexos(rows, arquivos, donos);
        console.log(relatorioConferencia(resultado));
        let semRegistro = resultado.semRegistro.length;
        if (process.argv.includes("--apagar-sem-registro") && semRegistro) {
            const r = await apagarSemRegistro(pasta, resultado.semRegistro);
            console.log(`Arquivos sem registro apagados do disco: ${r.apagados} de ${semRegistro}.`);
            if (r.jaSumiram) console.log(`Já não estavam no disco: ${r.jaSumiram}.`);
            if (r.recentes.length) {
                console.log(`Mantidos por serem recentes (menos de 10 minutos; rode de novo depois): ${r.recentes.length}`);
                r.recentes.forEach((a) => console.log(`  - ${a}`));
            }
            semRegistro -= r.apagados + r.jaSumiram;
        }
        if (resultado.semArquivo.length || resultado.semDono.length || semRegistro) process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main().catch((erro) => {
    console.error(erro.message ?? erro);
    process.exitCode = 2;
});
