import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/Entity/Projeto";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import EditarProjetoInput from "./EditarProjetoInput";

export default class EditarProjeto {
    private readonly projetos;
    private readonly usuarios;
    constructor(factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
        this.usuarios = factory.criarUsuarioRepository();
    }
    async execute(input: EditarProjetoInput): Promise<Projeto> {
        const atual = await this.projetos.buscarPorCodigo(input.codigo);
        if (!atual)
            throw new ErroNaoEncontrado("Projeto não encontrado.");
        const todos = await this.usuarios.listar();
        const membros = [...new Set(input.codigosMembros)].map(c => {
            const u = todos.find(x => x.codigo === c && x.ativo);
            if (!u)
                throw new ErroNaoEncontrado(`Usuário ativo não encontrado: ${c}`);
            return u;
        });
        return this.projetos.editar(new Projeto(input.nome.trim(), input.descricao.trim(), input.dataInicio, input.dataFim, atual.status, membros, atual.codigo));
    }
}
