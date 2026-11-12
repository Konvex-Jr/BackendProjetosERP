import Iniciativa from "../entity/Iniciativa";

/** Filtros de GET /iniciativas. Todos opcionais e combináveis. */
export interface FiltrosIniciativa {
    /** Texto procurado no título, descrição, resultado e aprendizados (sem diferenciar maiúsculas). */
    busca?: string;
    status?: string;
    tipo?: string;
    frente?: string;
    codigoResponsavel?: string;
    codigoProjeto?: string;
    /** Iniciativas ligadas a um item da Base. */
    codigoConhecimento?: string;
}

/** Iniciativas de inovação. Permissões ficam em shared/seguranca/regrasIniciativa.ts. */
export default interface IniciativaRepositoryInterface {
    criar(item: Iniciativa): Promise<Iniciativa>;
    /** Atualizadas mais recentemente primeiro. */
    listar(filtros?: FiltrosIniciativa): Promise<Iniciativa[]>;
    buscarPorCodigo(codigo: string): Promise<Iniciativa | null>;
    editar(item: Iniciativa): Promise<Iniciativa>;
    excluir(codigo: string): Promise<void>;
}
