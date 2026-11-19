import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/entity/Tarefa";
import Projeto from "../../domain/entity/Projeto";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { PapelColuna } from "../../domain/enum/ColunaProjeto";
import { hoje } from "../../shared/datas";
import CriarTarefaInput from "./CriarTarefaInput";
import { colunaDoProjeto } from "./colunaDoProjeto";

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
        let projeto: Projeto | null = null;
        if (input.codigoProjeto) {
            projeto = await this.projetos.buscarPorCodigo(input.codigoProjeto);
            if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
        }
        const coluna = projeto ? (input.codigoColuna ? colunaDoProjeto(projeto, input.codigoColuna) : projeto.colunaDeEntrada) : null;
        const nasceConcluida = coluna?.papel === PapelColuna.CONCLUIDA;
        const todos = await this.usuarios.listar();
        const responsaveis = [...new Set(input.codigosResponsaveis ?? [])].map((c) => {
            const u = todos.find((x) => x.codigo === c && x.ativo);
            if (!u) throw new ErroNaoEncontrado(`Responsável ativo não encontrado: ${c}`);
            if (projeto && !projeto.membros.some((m) => m.codigo === c))
                throw new ErroValidacao(`${u.nome} não está na equipe do projeto.`, "RESPONSAVEL_FORA_DO_PROJETO");
            return u;
        });
        const tarefa = new Tarefa(
            // Sem projeto, o construtor recusa com PROJETO_OBRIGATORIO.
            projeto as Projeto,
            (input.titulo ?? "").trim(),
            input.dataInicio,
            input.dataFim,
            undefined,
            input.prioridade,
            input.descricao ?? null,
            nasceConcluida ? hoje() : null,
            null,
            responsaveis,
            [],
            undefined,
            nasceConcluida ? (input.criadaPor ?? null) : null,
            input.criadaPor ?? null,
            coluna,
        );
        tarefa.exigirConclusaoCoerente();
        return this.tarefas.criar(tarefa);
    }
}
