import ColunaProjeto from "../../../domain/entity/ColunaProjeto";
import Tarefa from "../../../domain/entity/Tarefa";
import ColunaProjetoRepositoryInterface from "../../../domain/interfaces/ColunaProjetoRepositoryInterface";
import ProjetoRepositoryInterface from "../../../domain/interfaces/ProjetoRepositoryInterface";
import TarefaRepositoryInterface from "../../../domain/interfaces/TarefaRepositoryInterface";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";

/**
 * Na memória as colunas moram dentro do projeto e as tarefas guardam o projeto e a coluna como objetos:
 * ao trocar as colunas, todas as tarefas do projeto são reconstruídas com o projeto novo e a coluna
 * atual (nome e cor novos), como o banco faria ao ler de novo.
 */
export default class ColunaProjetoRepositoryMemory implements ColunaProjetoRepositoryInterface {
    constructor(
        private readonly projetos: ProjetoRepositoryInterface,
        private readonly tarefas: TarefaRepositoryInterface,
    ) {}

    async substituir(codigoProjeto: string, colunas: ColunaProjeto[], regravadas: Tarefa[]): Promise<void> {
        const projeto = await this.projetos.buscarPorCodigo(codigoProjeto);
        if (!projeto) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);
        const novo = projeto.comColunas(colunas);

        const atuais = await this.tarefas.listarPorProjeto(codigoProjeto);
        const reconstruidas = atuais.map((existente) => {
            const base = regravadas.find((t) => t.codigo === existente.codigo) ?? existente;
            const coluna = colunas.find((c) => c.codigo === base.coluna?.codigo);
            // Como a chave estrangeira do banco: tarefa numa coluna que saiu impede a troca.
            if (!coluna) throw new ErroConflito(MENSAGENS_DE_ERRO.COLUNA.QUADRO_MUDOU, "QUADRO_MUDOU");
            return new Tarefa(
                novo,
                base.titulo,
                base.dataInicio,
                base.dataFim,
                base.status,
                base.prioridade,
                base.descricao,
                base.dataConclusao,
                base.dependeDe,
                base.responsaveis,
                base.checklist,
                base.codigo,
                base.concluidaPor,
                base.categoria,
                base.criadaPor,
                coluna,
            );
        });

        await this.projetos.editar(novo);
        for (const tarefa of reconstruidas) await this.tarefas.editar(tarefa);
    }
}
