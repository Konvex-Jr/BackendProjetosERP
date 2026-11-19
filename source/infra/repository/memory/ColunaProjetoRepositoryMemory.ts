import ColunaProjeto from "../../../domain/entity/ColunaProjeto";
import Tarefa from "../../../domain/entity/Tarefa";
import Usuario from "../../../domain/entity/Usuario";
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

    async substituir(
        codigoProjeto: string,
        colunas: ColunaProjeto[],
        destinos: Map<string, string>,
        hoje: Date,
        quem: Usuario | null,
        novas: ReadonlySet<string> = new Set(),
    ): Promise<void> {
        const projeto = await this.projetos.buscarPorCodigo(codigoProjeto);
        if (!projeto) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);
        // Como no banco: coluna que não é nova tem de estar entre as atuais do projeto.
        if (colunas.some((c) => !novas.has(c.codigo) && !projeto.colunas.some((atual) => atual.codigo === c.codigo))) {
            throw new ErroConflito(MENSAGENS_DE_ERRO.COLUNA.QUADRO_MUDOU, "QUADRO_MUDOU");
        }
        const novo = projeto.comColunas(colunas);

        const atuais = await this.tarefas.listarPorProjeto(codigoProjeto);
        const reconstruidas = atuais.map((existente) => {
            const codigoColuna = destinos.get(existente.coluna?.codigo ?? "") ?? existente.coluna?.codigo;
            const coluna = colunas.find((c) => c.codigo === codigoColuna);
            // Como a chave estrangeira do banco: tarefa numa coluna que saiu impede a troca.
            if (!coluna) throw new ErroConflito(MENSAGENS_DE_ERRO.COLUNA.QUADRO_MUDOU, "QUADRO_MUDOU");
            // Status e conclusão pelo papel da coluna: entrar na concluída registra data e autor, sair apaga.
            const naColuna = existente.naColuna(coluna, hoje, quem);
            return new Tarefa(
                novo,
                naColuna.titulo,
                naColuna.dataInicio,
                naColuna.dataFim,
                naColuna.status,
                naColuna.prioridade,
                naColuna.descricao,
                naColuna.dataConclusao,
                naColuna.dependeDe,
                naColuna.responsaveis,
                naColuna.checklist,
                naColuna.codigo,
                naColuna.concluidaPor,
                naColuna.criadaPor,
                coluna,
                naColuna.dificuldade,
            );
        });

        await this.projetos.editar(novo);
        for (const tarefa of reconstruidas) await this.tarefas.editar(tarefa);
    }
}
