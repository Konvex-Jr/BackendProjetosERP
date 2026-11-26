import PermissoesRepositoryInterface, { ConjuntoPermissoes } from "../../../domain/interfaces/PermissoesRepositoryInterface";
import { PADRAO_MEMBRO, PADRAO_TRAINEE, Permissao } from "../../../shared/seguranca/catalogoPermissoes";

/** Começa com os mesmos padrões da migração 030. */
export default class PermissoesRepositoryMemory implements PermissoesRepositoryInterface {
    private readonly conjuntos: Record<ConjuntoPermissoes, Permissao[]> = {
        sem_cargo: [...PADRAO_MEMBRO],
        trainee: [...PADRAO_TRAINEE],
    };

    async conjunto(nome: ConjuntoPermissoes): Promise<Permissao[]> {
        return [...this.conjuntos[nome]];
    }

    async gravarConjunto(nome: ConjuntoPermissoes, permissoes: readonly Permissao[]): Promise<void> {
        this.conjuntos[nome] = [...new Set(permissoes)];
    }
}
