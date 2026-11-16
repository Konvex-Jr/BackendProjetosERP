import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Tarefa from "../../domain/entity/Tarefa";
import StatusTarefa from "../../domain/enum/StatusTarefa";
import Usuario from "../../domain/entity/Usuario";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { hoje as hojeNoFuso } from "../../shared/datas";

export default class AlterarStatusTarefa {
    private readonly tarefas;
    private readonly projetos;
    constructor(factory: RepositoryFactoryInterface) {
        this.tarefas = factory.criarTarefaRepository();
        this.projetos = factory.criarProjetoRepository();
    }
    async execute(codigo: string, status: StatusTarefa, hoje = hojeNoFuso(), quem: Usuario | null = null): Promise<Tarefa> {
        const t = await this.tarefas.buscarPorCodigo(codigo);
        if (!t) throw new ErroNaoEncontrado("Tarefa não encontrada.");
        // Tarefa de projeto: o status escolhe a coluna (a atual, se já serve) e a coluna manda no resto.
        if (t.projeto && Object.values(StatusTarefa).includes(status)) {
            const projeto = await this.projetos.buscarPorCodigo(t.projeto.codigo);
            if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
            const movida = t.naColuna(projeto.colunaParaStatus(status, t.coluna), hoje, quem);
            movida.exigirConclusaoCoerente();
            return this.tarefas.editar(movida);
        }
        const concluida = status === StatusTarefa.CONCLUIDA;
        const jaConcluida = t.status === StatusTarefa.CONCLUIDA;
        // Se já estava concluída, mantém data e autor originais.
        const editada = t.comStatus(
            status,
            concluida ? (jaConcluida ? t.dataConclusao : hoje) : null,
            concluida ? (jaConcluida ? t.concluidaPor : quem) : null,
        );
        editada.exigirConclusaoCoerente();
        return this.tarefas.editar(editada);
    }
}
