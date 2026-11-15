import ItemBiblioteca from "../../../domain/entity/ItemBiblioteca";
import SigiloBiblioteca from "../../../domain/enum/SigiloBiblioteca";
import BibliotecaRepositoryInterface, { FiltrosBiblioteca } from "../../../domain/interfaces/BibliotecaRepositoryInterface";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

/** Mesmo critério do SQL (ILIKE): sem diferenciar maiúsculas, com acentos. */
function atende(item: ItemBiblioteca, f: FiltrosBiblioteca): boolean {
    if (f.busca) {
        const texto = [item.titulo, item.conteudo, item.tags.join(" ")].join("\n").toLowerCase();
        if (!texto.includes(f.busca.toLowerCase())) return false;
    }
    if (f.tag && !item.tags.includes(f.tag.toLowerCase())) return false;
    if (f.codigoProjeto && item.projeto?.codigo !== f.codigoProjeto) return false;
    if (f.sigilo && item.sigilo !== f.sigilo) return false;
    if (f.codigoAutor && item.autor?.codigo !== f.codigoAutor) return false;
    return true;
}

export default class BibliotecaRepositoryMemory implements BibliotecaRepositoryInterface {
    private itens: ItemBiblioteca[] = [];

    async criar(item: ItemBiblioteca): Promise<ItemBiblioteca> {
        this.itens.push(item);
        return item;
    }

    async listar(filtros: FiltrosBiblioteca = {}): Promise<ItemBiblioteca[]> {
        return this.itens.filter((i) => atende(i, filtros)).sort((a, b) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime());
    }

    async buscarPorCodigo(codigo: string): Promise<ItemBiblioteca | null> {
        return this.itens.find((i) => i.codigo === codigo) ?? null;
    }

    async editar(item: ItemBiblioteca): Promise<ItemBiblioteca> {
        const indice = this.itens.findIndex((i) => i.codigo === item.codigo);
        if (indice === -1) throw new ErroNaoEncontrado("Item não encontrado.");
        this.itens[indice] = item;
        return item;
    }

    async excluir(codigo: string): Promise<void> {
        this.itens = this.itens.filter((i) => i.codigo !== codigo);
    }

    async desligarProjeto(codigoProjeto: string): Promise<void> {
        this.itens = this.itens.map((i) =>
            i.projeto?.codigo === codigoProjeto && i.sigilo !== SigiloBiblioteca.PROJETO ? new ItemBiblioteca({ ...i, projeto: null }) : i,
        );
    }
}
