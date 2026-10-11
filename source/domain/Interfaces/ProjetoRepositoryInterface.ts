import Projeto from "../Entity/Projeto";

export default interface ProjetoRepositoryInterface {
    criar(projeto: Projeto): Promise<Projeto>;
    listar(): Promise<Projeto[]>;
    listarPorMembro(codigoUsuario: string): Promise<Projeto[]>;
    buscarPorCodigo(codigo: string): Promise<Projeto | null>;
    editar(projeto: Projeto): Promise<Projeto>;
    excluir(codigo: string): Promise<void>;
}
