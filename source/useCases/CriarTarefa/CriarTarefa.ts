import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/Entity/Tarefa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import CriarTarefaInput from "./CriarTarefaInput";

export default class CriarTarefa {
    private readonly tarefas;
    private readonly projetos;
    private readonly usuarios;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
        this.projetos = factory.criarProjetoRepository();
        this.usuarios = factory.criarUsuarioRepository();
    }
    async execute(input: CriarTarefaInput): Promise<Tarefa> {
        const projeto = await this.projetos.buscarPorCodigo(input.codigoProjeto);
        if (!projeto)
            throw new ErroNaoEncontrado("Projeto não encontrado.");
        const todos = await this.usuarios.listar();
        const responsaveis = [...new Set(input.codigosResponsaveis ?? [])].map(c => {
            const u = todos.find(x => x.codigo === c && x.ativo);
            if (!u)
                throw new ErroNaoEncontrado(`Responsável ativo não encontrado: ${c}`);
            return u;
        });
        return this.tarefas.criar(new Tarefa(projeto, input.titulo.trim(), input.dataInicio, input.dataFim, undefined, input.prioridade, input.descricao ?? null, null, null, responsaveis));
    }
}
