import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { CORES_COLUNA, CorColuna, PapelColuna } from "../enum/ColunaProjeto";

export const MAX_NOME_COLUNA = 40;
export const MIN_COLUNAS = 2;
export const MAX_COLUNAS = 12;

/**
 * Coluna do kanban de um projeto. Valida só a própria coluna: as regras do conjunto
 * (quantidade, entrada e concluída únicas, nomes únicos) ficam em `validarColunas`, chamada ao gravar.
 */
export default class ColunaProjeto {
    readonly codigo: string;
    readonly nome: string;
    readonly cor: CorColuna;
    readonly papel: PapelColuna;

    constructor(nome: string, cor: CorColuna, papel: PapelColuna, codigo?: string) {
        this.codigo = codigo ?? uuid();
        this.nome = String(nome ?? "").trim();
        this.cor = cor;
        this.papel = papel;

        if (this.nome.length < 1 || this.nome.length > MAX_NOME_COLUNA) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.NOME_INVALIDO(this.nome), "NOME_COLUNA_INVALIDO");
        }
        if (!CORES_COLUNA.includes(cor)) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.COR_INVALIDA(this.nome), "COR_COLUNA_INVALIDA");
        }
        if (!Object.values(PapelColuna).includes(papel)) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.PAPEL_INVALIDO(this.nome), "PAPEL_COLUNA_INVALIDO");
        }
    }

    toJSON() {
        return { codigo: this.codigo, nome: this.nome, cor: this.cor, papel: this.papel };
    }
}

export function colunasPadrao(): ColunaProjeto[] {
    return [
        new ColunaProjeto("A fazer", "cinza", PapelColuna.ENTRADA),
        new ColunaProjeto("Fazendo", "azul", PapelColuna.MEIO),
        new ColunaProjeto("Revisando", "amarelo", PapelColuna.MEIO),
        new ColunaProjeto("Concluído", "verde", PapelColuna.CONCLUIDA),
    ];
}

/** Regras do conjunto de colunas. Chamada só ao gravar: nunca ao ler do banco. */
export function validarColunas(colunas: ColunaProjeto[]): void {
    if (colunas.length < MIN_COLUNAS || colunas.length > MAX_COLUNAS) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.QUANTIDADE_INVALIDA(colunas.length), "QUANTIDADE_COLUNAS_INVALIDA");
    }

    const vistos = new Set<string>();
    for (const coluna of colunas) {
        const chave = coluna.nome.toLowerCase();
        if (vistos.has(chave)) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.NOME_REPETIDO(coluna.nome), "NOME_COLUNA_REPETIDO");
        }
        vistos.add(chave);
    }

    if (colunas.filter((c) => c.papel === PapelColuna.ENTRADA).length !== 1) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.ENTRADA_UNICA, "COLUNA_ENTRADA_UNICA");
    }
    if (colunas.filter((c) => c.papel === PapelColuna.CONCLUIDA).length !== 1) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.CONCLUIDA_UNICA, "COLUNA_CONCLUIDA_UNICA");
    }
}
