import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/Entity/Projeto";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import CriarProjetoInput from "./CriarProjetoInput";

export default class CriarProjeto {
    private readonly projetos;
    private readonly usuarios;
    constructor(factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
        this.usuarios = factory.criarUsuarioRepository();
    }
    async execute(input: CriarProjetoInput): Promise<Projeto> {
        const todos = await this.usuarios.listar();
        const codigos = [...new Set(input.codigosMembros ?? [])];
        const membros = codigos.map(c => {
            const u = todos.find(x => x.codigo === c && x.ativo);
            if (!u)
                throw new ErroNaoEncontrado(`Usuário ativo não encontrado: ${c}`);
            return u;
        });
        return this.projetos.criar(new Projeto(input.nome.trim(), input.descricao.trim(), input.dataInicio, input.dataFim, undefined, membros));
    }
}
