import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { CategoriaConhecimento, ehCategoriaConhecimento, LISTA_CATEGORIAS_CONHECIMENTO } from "../Enum/CategoriaConhecimento";

/** Referência curta (só o necessário para exibir). */
export interface Referencia {
    codigo: string;
    nome: string;
}

export interface DadosConhecimento {
    titulo: string;
    categoria: string;
    resumo: string;
    conteudo?: string;
    fonte?: string | null;
    links?: string[];
    tags?: string[];
    data?: Date;
    autor?: Referencia | null;
    projetos?: Referencia[];
    codigo?: string;
    criadoEm?: Date;
    atualizadoEm?: Date;
}

const M = MENSAGENS_DE_ERRO.CONHECIMENTO;

function hoje(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Tags em minúsculas, sem "#", sem repetição. */
export function normalizarTags(tags: unknown[] = []): string[] {
    const limpas = tags
        .map((t) =>
            String(t ?? "")
                .trim()
                .replace(/^#+/, "")
                .toLowerCase(),
        )
        .filter(Boolean);
    return [...new Set(limpas)];
}

function validarLink(link: string): string {
    let valido = false;
    try {
        valido = ["http:", "https:"].includes(new URL(link).protocol);
    } catch {
        valido = false;
    }
    if (!valido) {
        throw new ErroValidacao(`Link inválido: ${link}. Use um endereço começando com https://.`, "LINK_CONHECIMENTO_INVALIDO");
    }
    return link;
}

/**
 * Item da Base de Inteligência (RF-080). Conteúdo em Markdown simples (decisão de 03/11/2026).
 * Leitura aberta a todos (RF-083); quem altera está em shared/seguranca/regrasConhecimento.ts.
 */
export default class Conhecimento {
    readonly codigo: string;
    readonly titulo: string;
    readonly categoria: CategoriaConhecimento;
    readonly resumo: string;
    readonly conteudo: string;
    readonly fonte: string | null;
    readonly links: string[];
    readonly tags: string[];
    readonly data: Date;
    readonly autor: Referencia | null;
    readonly projetos: Referencia[];
    readonly criadoEm: Date;
    readonly atualizadoEm: Date;

    constructor(dados: DadosConhecimento) {
        this.codigo = dados.codigo ?? uuid();
        this.titulo = String(dados.titulo ?? "").trim();
        this.categoria = dados.categoria as CategoriaConhecimento;
        this.resumo = String(dados.resumo ?? "").trim();
        this.conteudo = String(dados.conteudo ?? "");
        this.fonte = String(dados.fonte ?? "").trim() || null;
        this.links = (dados.links ?? []).map((l) => String(l ?? "").trim()).filter(Boolean);
        this.tags = normalizarTags(dados.tags ?? []);
        this.data = dados.data ?? hoje();
        this.autor = dados.autor ?? null;
        this.projetos = dados.projetos ?? [];
        this.criadoEm = dados.criadoEm ?? new Date();
        this.atualizadoEm = dados.atualizadoEm ?? this.criadoEm;

        this.validar();
    }

    private validar(): void {
        if (!this.titulo) throw new ErroValidacao(M.TITULO_OBRIGATORIO, "TITULO_CONHECIMENTO_OBRIGATORIO");
        if (this.titulo.length > 160) throw new ErroValidacao(M.TITULO_LONGO, "TITULO_CONHECIMENTO_LONGO");
        if (!ehCategoriaConhecimento(this.categoria)) {
            throw new ErroValidacao(
                `Categoria inválida. Use uma destas: ${LISTA_CATEGORIAS_CONHECIMENTO}.`,
                "CATEGORIA_CONHECIMENTO_INVALIDA",
            );
        }
        if (!this.resumo) throw new ErroValidacao(M.RESUMO_OBRIGATORIO, "RESUMO_CONHECIMENTO_OBRIGATORIO");
        if (this.resumo.length > 500) throw new ErroValidacao(M.RESUMO_LONGO, "RESUMO_CONHECIMENTO_LONGO");
        if (this.conteudo.length > 50000) throw new ErroValidacao(M.CONTEUDO_LONGO, "CONTEUDO_CONHECIMENTO_LONGO");
        if (this.fonte && this.fonte.length > 300) throw new ErroValidacao(M.FONTE_LONGA, "FONTE_CONHECIMENTO_LONGA");
        if (this.tags.length > 10 || this.tags.some((t) => t.length > 40)) {
            throw new ErroValidacao(M.MUITAS_TAGS, "TAGS_CONHECIMENTO_INVALIDAS");
        }
        if (this.links.length > 10) throw new ErroValidacao(M.MUITOS_LINKS, "LINKS_CONHECIMENTO_DEMAIS");
        this.links.forEach(validarLink);
        if (Number.isNaN(this.data.getTime())) {
            throw new ErroValidacao("O campo data deve ser uma data válida.", "DATA_INVALIDA");
        }
    }
}
