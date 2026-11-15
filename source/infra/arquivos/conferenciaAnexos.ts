import { promises as fs } from "fs";
import path from "path";

/** Sessão 14b: conferência de anexos órfãos (registro sem arquivo, arquivo sem registro, anexo sem dono). */

export interface RegistroAnexo {
    codigo: string;
    donoTipo: string;
    donoCodigo: string;
    nome: string;
    arquivo: string;
}

export interface ResultadoConferencia {
    total: number;
    semArquivo: RegistroAnexo[];
    semDono: RegistroAnexo[];
    semRegistro: string[];
}

/** Nome que a API dá aos arquivos no disco (UUID). Outros arquivos da pasta são ignorados. */
const NOME_ARQUIVO = /^[0-9a-f-]{36}$/i;

/** Tabela de cada tipo de dono (a tabela `anexos` não tem chave estrangeira para o dono). */
export const TABELA_DO_DONO: Record<string, string> = {
    biblioteca: "biblioteca_itens",
    capacitacao: "capacitacoes",
};

export function conferirAnexos(registros: RegistroAnexo[], arquivosNoDisco: string[], donosExistentes: Set<string>): ResultadoConferencia {
    const noDisco = new Set(arquivosNoDisco.filter((a) => NOME_ARQUIVO.test(a)));
    const registrados = new Set(registros.map((r) => r.arquivo));
    return {
        total: registros.length,
        semArquivo: registros.filter((r) => !noDisco.has(r.arquivo)),
        semDono: registros.filter((r) => !donosExistentes.has(`${r.donoTipo}:${r.donoCodigo}`)),
        semRegistro: [...noDisco].filter((a) => !registrados.has(a)).sort(),
    };
}

export function relatorioConferencia(r: ResultadoConferencia): string {
    const linha = (x: RegistroAnexo) => `  - ${x.nome} (anexo ${x.codigo}, ${x.donoTipo} ${x.donoCodigo}, arquivo ${x.arquivo})`;
    const partes = [`Anexos registrados: ${r.total}`];
    partes.push(`Registro sem arquivo no disco: ${r.semArquivo.length}`, ...r.semArquivo.map(linha));
    partes.push(`Anexo cujo dono não existe mais: ${r.semDono.length}`, ...r.semDono.map(linha));
    partes.push(`Arquivo no disco sem registro: ${r.semRegistro.length}`, ...r.semRegistro.map((a) => `  - ${a}`));
    const ok = !r.semArquivo.length && !r.semDono.length && !r.semRegistro.length;
    partes.push(ok ? "Tudo certo: nenhum anexo órfão." : "Há anexos órfãos (veja acima). Nada foi apagado pela conferência.");
    return partes.join("\n");
}

/** Arquivo mais novo que isto pode ser um upload em andamento (arquivo gravado, registro ainda não). */
export const IDADE_MINIMA_PARA_APAGAR_MS = 10 * 60 * 1000;

export interface ResultadoApagar {
    apagados: number;
    /** Já não estavam no disco (contam como resolvidos). */
    jaSumiram: number;
    /** Modificados há menos de 10 minutos: ficam, podem ser upload em andamento. */
    recentes: string[];
}

/**
 * Sessão 17: apaga do disco os arquivos sem registro (os anexos dos módulos removidos pela
 * migração 012). Só apaga nomes no padrão da API (UUID), dentro da pasta dos anexos; qualquer
 * outro nome é ignorado. O upload grava o arquivo antes do registro, então arquivo modificado
 * há menos de IDADE_MINIMA_PARA_APAGAR_MS fica (vai em `recentes`).
 */
export async function apagarSemRegistro(
    pasta: string,
    nomes: string[],
    idadeMinimaMs: number = IDADE_MINIMA_PARA_APAGAR_MS,
): Promise<ResultadoApagar> {
    const resultado: ResultadoApagar = { apagados: 0, jaSumiram: 0, recentes: [] };
    for (const nome of nomes) {
        if (!NOME_ARQUIVO.test(nome)) continue;
        const caminho = path.join(pasta, nome);
        try {
            const { mtimeMs } = await fs.stat(caminho);
            if (Date.now() - mtimeMs < idadeMinimaMs) {
                resultado.recentes.push(nome);
                continue;
            }
            await fs.unlink(caminho);
            resultado.apagados++;
        } catch (erro: any) {
            if (erro?.code !== "ENOENT") throw erro;
            resultado.jaSumiram++;
        }
    }
    return resultado;
}
