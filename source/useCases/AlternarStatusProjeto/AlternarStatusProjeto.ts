import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/Entity/Projeto";
import StatusProjeto from "../../domain/Enum/StatusProjeto";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class AlternarStatusProjeto {
    private readonly projetos;
    constructor(factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
    }
    async execute(codigo: string): Promise<Projeto> {
        const p = await this.projetos.buscarPorCodigo(codigo);
        if (!p)
            throw new ErroNaoEncontrado("Projeto não encontrado.");
        const status = p.status === StatusProjeto.CONCLUIDO ? StatusProjeto.EM_EXECUCAO : StatusProjeto.CONCLUIDO;
        return this.projetos.editar(new Projeto(p.nome, p.descricao, p.dataInicio, p.dataFim, status, p.membros, p.codigo));
    }
}
