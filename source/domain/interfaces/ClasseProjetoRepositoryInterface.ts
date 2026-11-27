import ClasseProjeto from "../entity/ClasseProjeto";

/** Classes de projeto (sessão 31b), cadastradas em Configurações. */
export default interface ClasseProjetoRepositoryInterface {
    /** Em ordem e, no empate, por nome. */
    listar(): Promise<ClasseProjeto[]>;
    buscarPorCodigo(codigo: string): Promise<ClasseProjeto | null>;
    /** 409 CLASSE_DUPLICADA se o código ou o nome já existe. */
    criar(classe: ClasseProjeto): Promise<ClasseProjeto>;
    editar(classe: ClasseProjeto): Promise<ClasseProjeto>;
}
