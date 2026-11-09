import GerirAnexos from "../GerirAnexos/GerirAnexos";
import { DonoAnexo } from "../../domain/Enum/Anexo";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Conhecimento, { Referencia } from "../../domain/Entity/Conhecimento";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { lerData, lerLista } from "../../shared/entradas";
import { exigirAlterarConhecimento } from "../../shared/seguranca/regrasConhecimento";
import { exigirAutenticado, UsuarioAutenticado } from "../../shared/seguranca/permissoes";

/** Corpo de POST/PUT /conhecimento. Tags e links aceitam array ou texto separado por vírgulas. */
export interface EntradaConhecimento {
    titulo?: unknown;
    categoria?: unknown;
    resumo?: unknown;
    conteudo?: unknown;
    fonte?: unknown;
    links?: unknown;
    tags?: unknown;
    data?: unknown;
    codigosProjetos?: unknown;
}

function lerTexto(valor: unknown): string {
    return valor === undefined || valor === null ? "" : String(valor);
}

function lerListaDeTexto(valor: unknown, campo: string): string[] {
    if (valor !== undefined && valor !== null && typeof valor !== "string" && !Array.isArray(valor)) {
        throw new ErroValidacao(`O campo ${campo} deve ser uma lista.`, "LISTA_INVALIDA");
    }
    return lerLista(valor);
}

export default class SalvarConhecimento {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    private async projetos(codigos: string[]): Promise<Referencia[]> {
        const repo = this.factory.criarProjetoRepository();
        const unicos = [...new Set(codigos)];
        const encontrados: Referencia[] = [];
        for (const codigo of unicos) {
            const projeto = await repo.buscarPorCodigo(codigo);
            if (!projeto) throw new ErroNaoEncontrado(`Projeto não encontrado: ${codigo}.`);
            encontrados.push({ codigo: projeto.codigo, nome: projeto.nome });
        }
        return encontrados.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    private async montar(entrada: EntradaConhecimento, base: Partial<Conhecimento>): Promise<Conhecimento> {
        return new Conhecimento({
            codigo: base.codigo,
            autor: base.autor ?? null,
            criadoEm: base.criadoEm,
            atualizadoEm: base.codigo ? new Date() : undefined,
            titulo: lerTexto(entrada.titulo),
            categoria: lerTexto(entrada.categoria),
            resumo: lerTexto(entrada.resumo),
            conteudo: lerTexto(entrada.conteudo),
            fonte: lerTexto(entrada.fonte) || null,
            links: lerListaDeTexto(entrada.links, "links"),
            tags: lerListaDeTexto(entrada.tags, "tags"),
            data: lerData(entrada.data, "data") ?? base.data,
            projetos: await this.projetos(lerListaDeTexto(entrada.codigosProjetos, "codigosProjetos")),
        });
    }

    async criar(usuario: UsuarioAutenticado | null | undefined, entrada: EntradaConhecimento): Promise<Conhecimento> {
        const autenticado = exigirAutenticado(usuario);
        const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(autenticado.codigo);
        const autor = pessoa ? { codigo: pessoa.codigo, nome: pessoa.nome } : null;
        const item = await this.montar(entrada, { autor });
        return this.factory.criarConhecimentoRepository().criar(item);
    }

    async editar(usuario: UsuarioAutenticado | null | undefined, codigo: string, entrada: EntradaConhecimento): Promise<Conhecimento> {
        const repo = this.factory.criarConhecimentoRepository();
        const atual = await repo.buscarPorCodigo(codigo);
        if (!atual) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CONHECIMENTO.NAO_ENCONTRADO);
        exigirAlterarConhecimento(usuario, atual);
        return repo.editar(await this.montar(entrada, atual));
    }

    async excluir(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<{ codigo: string }> {
        const repo = this.factory.criarConhecimentoRepository();
        const atual = await repo.buscarPorCodigo(codigo);
        if (!atual) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CONHECIMENTO.NAO_ENCONTRADO);
        exigirAlterarConhecimento(usuario, atual);
        await new GerirAnexos(this.factory).excluirDosDonos(DonoAnexo.CONHECIMENTO, [codigo]);
        await repo.excluir(codigo);
        return { codigo };
    }
}
