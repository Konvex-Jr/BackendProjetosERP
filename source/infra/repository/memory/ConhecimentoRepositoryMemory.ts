import Conhecimento from "../../../domain/entity/Conhecimento";
import ConhecimentoRepositoryInterface, { FiltrosConhecimento } from "../../../domain/interfaces/ConhecimentoRepositoryInterface";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

/** Mesmo critério do SQL (ILIKE): sem diferenciar maiúsculas, com acentos. */
function atende(item: Conhecimento, f: FiltrosConhecimento): boolean {
    if (f.busca) {
        const termo = f.busca.toLowerCase();
        const texto = [item.titulo, item.resumo, item.conteudo, item.tags.join(" ")].join("\n").toLowerCase();
        if (!texto.includes(termo)) return false;
    }
    if (f.categoria && item.categoria !== f.categoria) return false;
    if (f.tag && !item.tags.includes(f.tag.toLowerCase())) return false;
    if (f.codigoAutor && item.autor?.codigo !== f.codigoAutor) return false;
    if (f.codigoProjeto && !item.projetos.some((p) => p.codigo === f.codigoProjeto)) return false;
    if (f.de && item.data < f.de) return false;
    if (f.ate && item.data > f.ate) return false;
    return true;
}

export default class ConhecimentoRepositoryMemory implements ConhecimentoRepositoryInterface {
    private itens: Conhecimento[] = [];

    async criar(item: Conhecimento): Promise<Conhecimento> {
        this.itens.push(item);
        return item;
    }

    async listar(filtros: FiltrosConhecimento = {}): Promise<Conhecimento[]> {
        return this.itens
            .filter((i) => atende(i, filtros))
            .sort((a, b) => b.data.getTime() - a.data.getTime() || b.criadoEm.getTime() - a.criadoEm.getTime());
    }

    async buscarPorCodigo(codigo: string): Promise<Conhecimento | null> {
        return this.itens.find((i) => i.codigo === codigo) ?? null;
    }

    async editar(item: Conhecimento): Promise<Conhecimento> {
        const indice = this.itens.findIndex((i) => i.codigo === item.codigo);
        if (indice === -1) throw new ErroNaoEncontrado("Item não encontrado.");
        this.itens[indice] = item;
        return item;
    }

    async excluir(codigo: string): Promise<void> {
        this.itens = this.itens.filter((i) => i.codigo !== codigo);
    }
}
