import Iniciativa from "../../../domain/Entity/Iniciativa";
import IniciativaRepositoryInterface, { FiltrosIniciativa } from "../../../domain/Interfaces/IniciativaRepositoryInterface";

/** Mesmo critério do SQL (ILIKE): sem diferenciar maiúsculas, com acentos. */
function atende(item: Iniciativa, f: FiltrosIniciativa): boolean {
    if (f.busca) {
        const texto = [item.titulo, item.descricao, item.resultado, item.aprendizados].join("\n").toLowerCase();
        if (!texto.includes(f.busca.toLowerCase())) return false;
    }
    if (f.status && item.status !== f.status) return false;
    if (f.tipo && item.tipo !== f.tipo) return false;
    if (f.frente && item.frente !== f.frente) return false;
    if (f.codigoResponsavel && item.responsavel?.codigo !== f.codigoResponsavel) return false;
    if (f.codigoProjeto && !item.projetos.some((p) => p.codigo === f.codigoProjeto)) return false;
    if (f.codigoConhecimento && !item.conhecimentos.some((c) => c.codigo === f.codigoConhecimento)) return false;
    return true;
}

export default class IniciativaRepositoryMemory implements IniciativaRepositoryInterface {
    private itens: Iniciativa[] = [];

    async criar(item: Iniciativa): Promise<Iniciativa> {
        this.itens.push(item);
        return item;
    }

    async listar(filtros: FiltrosIniciativa = {}): Promise<Iniciativa[]> {
        return this.itens
            .filter((i) => atende(i, filtros))
            .sort((a, b) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime());
    }

    async buscarPorCodigo(codigo: string): Promise<Iniciativa | null> {
        return this.itens.find((i) => i.codigo === codigo) ?? null;
    }

    async editar(item: Iniciativa): Promise<Iniciativa> {
        const indice = this.itens.findIndex((i) => i.codigo === item.codigo);
        if (indice === -1) throw new Error("Iniciativa não encontrada");
        this.itens[indice] = item;
        return item;
    }

    async excluir(codigo: string): Promise<void> {
        this.itens = this.itens.filter((i) => i.codigo !== codigo);
    }
}
