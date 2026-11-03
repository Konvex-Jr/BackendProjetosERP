import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/Entity/Tarefa";
import ItemChecklistTarefa from "../../domain/Entity/ItemChecklistTarefa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import EditarTarefaInput from "./EditarTarefaInput";
import CategoriaTarefa from "../../domain/Enum/CategoriaTarefa";
import { referenciaDaIniciativa } from "../SalvarIniciativa/SalvarIniciativa";

export default class EditarTarefa {
    private readonly tarefas;
    private readonly usuarios;
    private readonly projetos;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
        this.usuarios = factory.criarUsuarioRepository();
        this.projetos = factory.criarProjetoRepository();
    }
    async execute(input: EditarTarefaInput): Promise<Tarefa> {
        const atual = await this.tarefas.buscarPorCodigo(input.codigo);
        if (!atual)
            throw new ErroNaoEncontrado("Tarefa não encontrada.");
        const todas = await this.usuarios.listar();
        const projeto = atual.projeto ? await this.projetos.buscarPorCodigo(atual.projeto.codigo) : null;
        const jaEram = new Set(atual.responsaveis.map(r => r.codigo));
        const responsaveis = [...new Set(input.codigosResponsaveis)].map(c => {
            const u = todas.find(x => x.codigo === c && x.ativo);
            if (!u)
                throw new ErroNaoEncontrado(`Responsável ativo não encontrado: ${c}`);
            // Quem já era responsável continua, mesmo que tenha saído da equipe; quem entra precisa estar nela.
            if (!jaEram.has(c) && projeto && !projeto.membros.some(m => m.codigo === c))
                throw new ErroValidacao(`${u.nome} não está na equipe do projeto.`, "RESPONSAVEL_FORA_DO_PROJETO");
            return u;
        });
        let dependencia = null;
        if (input.codigoDependencia) {
            dependencia = await this.tarefas.buscarPorCodigo(input.codigoDependencia);
            if (!dependencia)
                throw new ErroNaoEncontrado("Tarefa predecessora não encontrada.");
            if (!atual.projeto || dependencia.projeto?.codigo !== atual.projeto.codigo)
                throw new ErroValidacao("A tarefa predecessora deve pertencer ao mesmo projeto.", "DEPENDENCIA_OUTRO_PROJETO");
            if (await this.criaCiclo(input.codigo, dependencia.codigo))
                throw new ErroValidacao("A dependência criaria um ciclo.", "DEPENDENCIA_CIRCULAR");
        }
        const concluida = input.status === "concluida";
        const checklist = input.checklist === undefined
            ? atual.checklist
            : input.checklist.map((item) => new ItemChecklistTarefa(item.texto, item.feito, item.codigo));

        const categoria = atual.projeto ? null : (input.categoria ?? atual.categoria);
        // Sem codigoIniciativa no corpo, a ligação continua (e cai sozinha se a tarefa deixar de ser de Inovação).
        const iniciativa = input.codigoIniciativa === undefined
            ? (categoria === CategoriaTarefa.INOVACAO ? atual.iniciativa : null)
            : await referenciaDaIniciativa(this.factory, input.codigoIniciativa);

        return this.tarefas.editar(new Tarefa(
            atual.projeto,
            input.titulo,
            input.dataInicio,
            input.dataFim,
            input.status,
            input.prioridade,
            input.descricao ?? null,
            concluida ? (atual.dataConclusao ?? new Date()) : null,
            dependencia,
            responsaveis,
            checklist,
            atual.codigo,
            concluida ? (atual.dataConclusao ? atual.concluidaPor : input.quem ?? null) : null,
            // Tarefa avulsa pode trocar de categoria; não vira tarefa de projeto (nem o contrário).
            categoria,
            atual.criadaPor,
            iniciativa,
        ));
    }
    private async criaCiclo(codigoAtual: string, codigoPredecessora: string): Promise<boolean> {
        let atual = await this.tarefas.buscarPorCodigo(codigoPredecessora);
        const vistos = new Set<string>([codigoAtual]);
        while (atual) {
            if (vistos.has(atual.codigo))
                return true;
            vistos.add(atual.codigo);
            atual = atual.dependeDe ? await this.tarefas.buscarPorCodigo(atual.dependeDe.codigo) : null;
        }
        return false;
    }
}
