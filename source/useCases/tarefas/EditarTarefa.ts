import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/entity/Tarefa";
import StatusTarefa from "../../domain/enum/StatusTarefa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import EditarTarefaInput from "./EditarTarefaInput";
import { PapelColuna } from "../../domain/enum/ColunaProjeto";
import { hoje } from "../../shared/datas";
import { colunaDoProjeto } from "./colunaDoProjeto";
import { limparResponsaveisQueSairam, montarChecklist } from "./montarChecklist";

export default class EditarTarefa {
    private readonly tarefas;
    private readonly usuarios;
    private readonly projetos;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
        this.usuarios = factory.criarUsuarioRepository();
        this.projetos = factory.criarProjetoRepository();
    }
    async execute(input: EditarTarefaInput): Promise<Tarefa> {
        const atual = await this.tarefas.buscarPorCodigo(input.codigo);
        if (!atual) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        const todas = await this.usuarios.listar();
        const projeto = await this.projetos.buscarPorCodigo(atual.projeto.codigo);
        if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
        const jaEram = new Set(atual.responsaveis.map((r) => r.codigo));
        const responsaveis = input.manterResponsaveis
            ? atual.responsaveis
            : [...new Set(input.codigosResponsaveis)].map((c) => {
                  const u = todas.find((x) => x.codigo === c && x.ativo);
                  if (!u) throw new ErroNaoEncontrado(`Responsável ativo não encontrado: ${c}`);
                  // Quem já era responsável continua, mesmo que tenha saído da equipe; quem entra precisa estar nela.
                  if (!jaEram.has(c) && !projeto.membros.some((m) => m.codigo === c))
                      throw new ErroValidacao(`${u.nome} não está na equipe do projeto.`, "RESPONSAVEL_FORA_DO_PROJETO");
                  return u;
              });
        let dependencia = null;
        if (input.codigoDependencia) {
            dependencia = await this.tarefas.buscarPorCodigo(input.codigoDependencia);
            if (!dependencia) throw new ErroNaoEncontrado("Tarefa predecessora não encontrada.");
            if (dependencia.projeto?.codigo !== atual.projeto.codigo)
                throw new ErroValidacao("A tarefa predecessora deve pertencer ao mesmo projeto.", "DEPENDENCIA_OUTRO_PROJETO");
            if (await this.criaCiclo(input.codigo, dependencia.codigo))
                throw new ErroValidacao("A dependência criaria um ciclo.", "DEPENDENCIA_CIRCULAR");
        }
        // Com coluna, ela vale; sem, o status escolhe a coluna.
        let coluna = null;
        const status = input.manterSituacao ? atual.status : input.status;
        const codigoColuna = input.manterSituacao ? (atual.coluna?.codigo ?? null) : input.codigoColuna;
        if (codigoColuna) coluna = colunaDoProjeto(projeto, codigoColuna);
        else if (Object.values(StatusTarefa).includes(status)) coluna = projeto.colunaParaStatus(status, atual.coluna);
        const concluida = coluna ? coluna.papel === PapelColuna.CONCLUIDA : status === "concluida";
        const sairam = new Set([...jaEram].filter((c) => !responsaveis.some((r) => r.codigo === c)));
        const checklist =
            input.checklist === undefined
                ? limparResponsaveisQueSairam(atual.checklist, responsaveis)
                : montarChecklist(input.checklist, { responsaveis, sairam, atuais: atual.checklist });

        const editada = new Tarefa(
            atual.projeto,
            input.titulo,
            input.dataInicio,
            input.dataFim,
            status,
            input.prioridade,
            input.descricao ?? null,
            concluida ? (atual.dataConclusao ?? hoje()) : null,
            dependencia,
            responsaveis,
            checklist,
            atual.codigo,
            concluida ? (atual.dataConclusao ? atual.concluidaPor : (input.quem ?? null)) : null,
            atual.criadaPor,
            coluna,
            input.dificuldade === undefined ? atual.dificuldade : input.dificuldade,
        );
        editada.exigirConclusaoCoerente();
        // Corrigir a data só vale para quem pode mudar a situação e se a tarefa segue concluída (reabrir zera a data).
        const corrigir = !input.manterSituacao && concluida && input.dataConclusao;
        return this.tarefas.editar(corrigir ? editada.comDataConclusao(input.dataConclusao as Date, hoje()) : editada);
    }
    private async criaCiclo(codigoAtual: string, codigoPredecessora: string): Promise<boolean> {
        let atual = await this.tarefas.buscarPorCodigo(codigoPredecessora);
        const vistos = new Set<string>([codigoAtual]);
        while (atual) {
            if (vistos.has(atual.codigo)) return true;
            vistos.add(atual.codigo);
            atual = atual.dependeDe ? await this.tarefas.buscarPorCodigo(atual.dependeDe.codigo) : null;
        }
        return false;
    }
}
