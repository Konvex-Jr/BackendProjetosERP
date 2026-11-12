import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/Entity/Tarefa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import CriarTarefaInput from "./CriarTarefaInput";
import { referenciaDaIniciativa } from "../SalvarIniciativa/SalvarIniciativa";

export default class CriarTarefa {
    private readonly tarefas;
    private readonly projetos;
    private readonly usuarios;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
        this.projetos = factory.criarProjetoRepository();
        this.usuarios = factory.criarUsuarioRepository();
    }
    async execute(input: CriarTarefaInput): Promise<Tarefa> {
        let projeto = null;
        if (input.codigoProjeto) {
            projeto = await this.projetos.buscarPorCodigo(input.codigoProjeto);
            if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
        }
        const todos = await this.usuarios.listar();
        const responsaveis = [...new Set(input.codigosResponsaveis ?? [])].map((c) => {
            const u = todos.find((x) => x.codigo === c && x.ativo);
            if (!u) throw new ErroNaoEncontrado(`Responsável ativo não encontrado: ${c}`);
            if (projeto && !projeto.membros.some((m) => m.codigo === c))
                throw new ErroValidacao(`${u.nome} não está na equipe do projeto.`, "RESPONSAVEL_FORA_DO_PROJETO");
            return u;
        });
        return this.tarefas.criar(
            new Tarefa(
                projeto,
                (input.titulo ?? "").trim(),
                input.dataInicio,
                input.dataFim,
                undefined,
                input.prioridade,
                input.descricao ?? null,
                null,
                null,
                responsaveis,
                [],
                undefined,
                null,
                input.categoria ?? null,
                input.criadaPor ?? null,
                await referenciaDaIniciativa(this.factory, input.codigoIniciativa),
            ),
        );
    }
}
