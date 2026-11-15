import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { normalizarTags, validarLink } from "../../shared/texto";
import SigiloBiblioteca, { ehSigiloBiblioteca } from "../enum/SigiloBiblioteca";
import { Referencia } from "./Referencia";

export interface DadosItemBiblioteca {
    titulo: string;
    conteudo?: string;
    links?: string[];
    tags?: string[];
    projeto?: Referencia | null;
    sigilo?: string;
    autor?: Referencia | null;
    codigo?: string;
    criadoEm?: Date;
    atualizadoEm?: Date;
}

const M = MENSAGENS_DE_ERRO.BIBLIOTECA;

/**
 * Item da Biblioteca (sessão 17): junta documentos, conhecimento e iniciativas.
 * Conteúdo em Markdown simples. Leitura por sigilo; quem altera está em shared/seguranca/regrasBiblioteca.ts.
 */
export default class ItemBiblioteca {
    readonly codigo: string;
    readonly titulo: string;
    readonly conteudo: string;
    readonly links: string[];
    readonly tags: string[];
    readonly projeto: Referencia | null;
    readonly sigilo: SigiloBiblioteca;
    readonly autor: Referencia | null;
    readonly criadoEm: Date;
    readonly atualizadoEm: Date;

    constructor(dados: DadosItemBiblioteca) {
        this.codigo = dados.codigo ?? uuid();
        this.titulo = String(dados.titulo ?? "").trim();
        this.conteudo = String(dados.conteudo ?? "");
        this.links = (dados.links ?? []).map((l) => String(l ?? "").trim()).filter(Boolean);
        this.tags = normalizarTags(dados.tags ?? []);
        this.projeto = dados.projeto ?? null;
        this.sigilo = (dados.sigilo || SigiloBiblioteca.TODOS) as SigiloBiblioteca;
        this.autor = dados.autor ?? null;
        this.criadoEm = dados.criadoEm ?? new Date();
        this.atualizadoEm = dados.atualizadoEm ?? this.criadoEm;

        this.validar();
    }

    private validar(): void {
        if (!this.titulo) throw new ErroValidacao(M.TITULO_OBRIGATORIO, "TITULO_BIBLIOTECA_OBRIGATORIO");
        if (this.titulo.length > 160) throw new ErroValidacao(M.TITULO_LONGO, "TITULO_BIBLIOTECA_LONGO");
        if (!ehSigiloBiblioteca(this.sigilo)) throw new ErroValidacao(M.SIGILO_INVALIDO, "SIGILO_BIBLIOTECA_INVALIDO");
        if (this.sigilo === SigiloBiblioteca.PROJETO && !this.projeto) {
            throw new ErroValidacao(M.PROJETO_OBRIGATORIO, "PROJETO_BIBLIOTECA_OBRIGATORIO");
        }
        if (this.conteudo.length > 50000) throw new ErroValidacao(M.CONTEUDO_LONGO, "CONTEUDO_BIBLIOTECA_LONGO");
        if (this.tags.length > 10 || this.tags.some((t) => t.length > 40)) {
            throw new ErroValidacao(M.MUITAS_TAGS, "TAGS_BIBLIOTECA_INVALIDAS");
        }
        if (this.links.length > 10) throw new ErroValidacao(M.MUITOS_LINKS, "LINKS_BIBLIOTECA_DEMAIS");
        this.links.forEach(validarLink);
    }
}
