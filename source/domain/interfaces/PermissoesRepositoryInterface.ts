import { Permissao } from "../../shared/seguranca/catalogoPermissoes";

/** Conjuntos de permissões que não são cargo (sessão 31a): quem não tem cargo e quem é trainee. */
export type ConjuntoPermissoes = "sem_cargo" | "trainee";

export const CONJUNTOS_PERMISSOES: ConjuntoPermissoes[] = ["sem_cargo", "trainee"];

export default interface PermissoesRepositoryInterface {
    conjunto(nome: ConjuntoPermissoes): Promise<Permissao[]>;
    gravarConjunto(nome: ConjuntoPermissoes, permissoes: readonly Permissao[]): Promise<void>;
}
