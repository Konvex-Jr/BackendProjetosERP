import PeriodoArea from "../entity/PeriodoArea";

/**
 * Períodos da pessoa nas áreas (spec 23, seção 5). Substitui o histórico de cargo e área.
 * Gravar um período que se sobrepõe a outro da mesma pessoa na mesma área lança
 * ErroValidacao `PERIODO_SOBREPOSTO` (no banco, pela constraint, mesmo em gravações simultâneas).
 */
export default interface PeriodoAreaRepositoryInterface {
    /** Todos os períodos da pessoa: abertos primeiro, depois por início decrescente. */
    listarDe(codigoUsuario: string): Promise<PeriodoArea[]>;
    /** Períodos abertos (fim nulo) de várias pessoas, numa consulta só. */
    listarAbertosDe(codigosUsuario: string[]): Promise<PeriodoArea[]>;
    buscarPorCodigo(codigo: string): Promise<PeriodoArea | null>;
    criar(periodo: PeriodoArea): Promise<PeriodoArea>;
    editar(periodo: PeriodoArea): Promise<PeriodoArea>;
    excluir(codigo: string): Promise<void>;
    /**
     * Encerra os períodos abertos da pessoa em `fim` e devolve quantos encerrou. O fim nunca fica
     * antes de início + 1 dia (o período [início, fim) não pode ficar vazio).
     */
    encerrarAbertosDe(codigoUsuario: string, fim: Date): Promise<number>;
}
