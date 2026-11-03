import Conhecimento from "../Entity/Conhecimento";

/** Filtros de GET /conhecimento (RF-082). Todos opcionais e combináveis. */
export interface FiltrosConhecimento {
    /** Texto procurado no título, resumo, conteúdo e tags (sem diferenciar maiúsculas). */
    busca?: string;
    categoria?: string;
    tag?: string;
    codigoAutor?: string;
    codigoProjeto?: string;
    /** Período pela data do item, inclusive. */
    de?: Date;
    ate?: Date;
}

export default interface ConhecimentoRepositoryInterface {
    criar(item: Conhecimento): Promise<Conhecimento>;
    /** Mais recentes primeiro (data do item, depois criação). */
    listar(filtros?: FiltrosConhecimento): Promise<Conhecimento[]>;
    buscarPorCodigo(codigo: string): Promise<Conhecimento | null>;
    editar(item: Conhecimento): Promise<Conhecimento>;
    excluir(codigo: string): Promise<void>;
}
