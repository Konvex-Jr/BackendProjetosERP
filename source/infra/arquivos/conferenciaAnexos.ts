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
    documento: "documentos",
    conhecimento: "conhecimentos",
    iniciativa: "iniciativas",
    capacitacao: "capacitacoes",
};

export function conferirAnexos(
    registros: RegistroAnexo[],
    arquivosNoDisco: string[],
    donosExistentes: Set<string>,
): ResultadoConferencia {
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
    partes.push(ok ? "Tudo certo: nenhum anexo órfão." : "Há anexos órfãos (veja acima). Nada foi apagado.");
    return partes.join("\n");
}
