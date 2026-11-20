import Tarefa from "../../../domain/entity/Tarefa";
import ItemChecklistTarefa from "../../../domain/entity/ItemChecklistTarefa";
import StatusTarefa from "../../../domain/enum/StatusTarefa";
import DificuldadeTarefa from "../../../domain/enum/DificuldadeTarefa";
import PrioridadeTarefa from "../../../domain/enum/PrioridadeTarefa";
import { fimDaSemana } from "../../../shared/datas";
import TarefaRepositoryInterface, { ContagemTarefas } from "../../../domain/interfaces/TarefaRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql, dataParaSqlOuNulo } from "../../database/conversoes";
import { carregarProjetos, carregarUsuarios } from "./carregadores";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";

const SELECT_TAREFA = `
    SELECT codigo, projeto_codigo, titulo, descricao, data_inicio, data_fim,
           status, prioridade, data_conclusao, depende_de_codigo, concluida_por_codigo,
           criada_por_codigo, coluna_codigo, dificuldade
    FROM tarefas
`;

/**
 * Tarefas no PostgreSQL. Responsáveis e checklist ficam em tabelas próprias e são regravados
 * por inteiro a cada edição (apaga e insere de novo, na mesma transação).
 */
export default class TarefaRepositoryDatabase implements TarefaRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(tarefa: Tarefa): Promise<Tarefa> {
        await this.conexao.transacao(async (conexao) => {
            await this.travarColuna(conexao, tarefa);
            await conexao.consultar(
                `INSERT INTO tarefas (codigo, projeto_codigo, titulo, descricao, data_inicio,
                                      data_fim, status, prioridade, data_conclusao, depende_de_codigo,
                                      concluida_por_codigo, criada_por_codigo, coluna_codigo, dificuldade)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [
                    tarefa.codigo,
                    tarefa.projeto.codigo,
                    tarefa.titulo,
                    tarefa.descricao,
                    dataParaSql(tarefa.dataInicio),
                    dataParaSql(tarefa.dataFim),
                    tarefa.status,
                    tarefa.prioridade,
                    dataParaSqlOuNulo(tarefa.dataConclusao),
                    tarefa.dependeDe?.codigo ?? null,
                    tarefa.concluidaPor?.codigo ?? null,
                    tarefa.criadaPor?.codigo ?? null,
                    tarefa.coluna.codigo,
                    tarefa.dificuldade,
                ],
            );
            await this.gravarRelacionamentos(conexao, tarefa);
        });

        return tarefa;
    }

    async listar(): Promise<Tarefa[]> {
        const linhas = await this.conexao.consultar("SELECT codigo FROM tarefas ORDER BY data_fim, prioridade");
        return this.carregar(linhas.map((l) => l.codigo));
    }

    async listarPorProjeto(codigoProjeto: string): Promise<Tarefa[]> {
        const linhas = await this.conexao.consultar("SELECT codigo FROM tarefas WHERE projeto_codigo = $1 ORDER BY data_fim, prioridade", [
            codigoProjeto,
        ]);
        return this.carregar(linhas.map((l) => l.codigo));
    }

    async listarCodigosPorProjeto(codigoProjeto: string): Promise<string[]> {
        const linhas = await this.conexao.consultar("SELECT codigo FROM tarefas WHERE projeto_codigo = $1", [codigoProjeto]);
        return linhas.map((l) => l.codigo);
    }

    async contarPorProjetos(codigosProjetos: string[], hoje: Date): Promise<Map<string, ContagemTarefas>> {
        const mapa = new Map<string, ContagemTarefas>(
            codigosProjetos.map((c) => [c, { total: 0, concluidas: 0, atrasadas: 0, semana: 0 }]),
        );
        if (!codigosProjetos.length) return mapa;
        const linhas = await this.conexao.consultar(
            `SELECT projeto_codigo::text AS projeto, count(*)::int AS total,
                    count(*) FILTER (WHERE status = 'concluida')::int AS concluidas,
                    count(*) FILTER (WHERE status <> 'concluida' AND data_fim < $2::date)::int AS atrasadas,
                    count(*) FILTER (WHERE status <> 'concluida' AND data_fim >= $2::date AND data_fim <= $3::date)::int AS semana
             FROM tarefas WHERE projeto_codigo::text = ANY($1::text[])
             GROUP BY projeto_codigo`,
            [codigosProjetos, dataParaSql(hoje), dataParaSql(fimDaSemana(hoje))],
        );
        for (const l of linhas) {
            mapa.set(l.projeto, { total: l.total, concluidas: l.concluidas, atrasadas: l.atrasadas, semana: l.semana });
        }
        return mapa;
    }

    async listarPorResponsavel(codigoUsuario: string): Promise<Tarefa[]> {
        const linhas = await this.conexao.consultar(
            `SELECT t.codigo
             FROM tarefas t
             JOIN tarefa_responsaveis tr ON tr.tarefa_codigo = t.codigo
             WHERE tr.usuario_codigo = $1
             ORDER BY t.data_fim, t.prioridade`,
            [codigoUsuario],
        );
        return this.carregar(linhas.map((l) => l.codigo));
    }

    async buscarPorCodigo(codigo: string): Promise<Tarefa | null> {
        const tarefas = await this.carregar([codigo]);
        return tarefas[0] ?? null;
    }

    async editar(tarefa: Tarefa): Promise<Tarefa> {
        await this.conexao.transacao(async (conexao) => {
            await this.travarColuna(conexao, tarefa);
            const linhas = await conexao.consultar(
                `UPDATE tarefas
                 SET titulo = $2, descricao = $3, data_inicio = $4, data_fim = $5,
                     status = $6, prioridade = $7, data_conclusao = $8, depende_de_codigo = $9,
                     concluida_por_codigo = $10, coluna_codigo = $11, dificuldade = $12
                 WHERE codigo = $1
                 RETURNING codigo`,
                [
                    tarefa.codigo,
                    tarefa.titulo,
                    tarefa.descricao,
                    dataParaSql(tarefa.dataInicio),
                    dataParaSql(tarefa.dataFim),
                    tarefa.status,
                    tarefa.prioridade,
                    dataParaSqlOuNulo(tarefa.dataConclusao),
                    tarefa.dependeDe?.codigo ?? null,
                    tarefa.concluidaPor?.codigo ?? null,
                    tarefa.coluna.codigo,
                    tarefa.dificuldade,
                ],
            );

            if (linhas.length === 0) {
                throw new ErroNaoEncontrado("Tarefa não encontrada.");
            }

            await conexao.consultar("DELETE FROM tarefa_responsaveis WHERE tarefa_codigo = $1", [tarefa.codigo]);
            await conexao.consultar("DELETE FROM tarefa_checklist_itens WHERE tarefa_codigo = $1", [tarefa.codigo]);
            await this.gravarRelacionamentos(conexao, tarefa);
        });

        return tarefa;
    }

    async marcarItem(codigoTarefa: string, codigoItem: string, feito: boolean): Promise<boolean> {
        const linhas = await this.conexao.consultar(
            "UPDATE tarefa_checklist_itens SET feito = $1 WHERE codigo = $2 AND tarefa_codigo = $3 RETURNING codigo",
            [feito, codigoItem, codigoTarefa],
        );
        return linhas.length > 0;
    }

    async excluir(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar("DELETE FROM tarefas WHERE codigo = $1 RETURNING codigo", [codigo]);

        if (linhas.length === 0) {
            throw new ErroNaoEncontrado("Tarefa não encontrada.");
        }
    }

    async excluirPorProjeto(codigoProjeto: string): Promise<void> {
        await this.conexao.consultar("DELETE FROM tarefas WHERE projeto_codigo = $1", [codigoProjeto]);
    }

    /**
     * Trava o projeto (FOR KEY SHARE) e depois a coluna da tarefa (FOR SHARE), e confere que o papel dela
     * ainda é o que o caso de uso viu. A gravação do quadro reescreve as colunas na própria transação: ou
     * espera esta tarefa, ou esta espera ela, e a tarefa nunca grava um status que o papel da coluna não
     * sustenta mais. Ordem projeto → coluna, a mesma de quem exclui o projeto (FOR UPDATE nele, e o DELETE
     * leva as colunas em cascata): na ordem contrária as duas transações podiam travar uma à outra (40P01).
     */
    private async travarColuna(conexao: ConexaoBanco, tarefa: Tarefa): Promise<void> {
        const projeto = await conexao.consultar("SELECT 1 FROM projetos WHERE codigo = $1 FOR KEY SHARE", [tarefa.projeto.codigo]);
        if (projeto.length === 0) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);
        if (!tarefa.coluna) return;
        const linhas = await conexao.consultar("SELECT papel FROM colunas_projeto WHERE codigo = $1 FOR SHARE", [tarefa.coluna.codigo]);
        if (linhas.length === 0 || linhas[0].papel !== tarefa.coluna.papel) {
            throw new ErroConflito(MENSAGENS_DE_ERRO.COLUNA.QUADRO_MUDOU, "QUADRO_MUDOU");
        }
    }

    private async gravarRelacionamentos(conexao: ConexaoBanco, tarefa: Tarefa): Promise<void> {
        await conexao.consultar(
            `INSERT INTO tarefa_responsaveis (tarefa_codigo, usuario_codigo)
             SELECT $1::uuid, unnest($2::uuid[])`,
            [tarefa.codigo, tarefa.responsaveis.map((r) => r.codigo)],
        );

        for (let ordem = 0; ordem < tarefa.checklist.length; ordem++) {
            const item = tarefa.checklist[ordem];
            await conexao.consultar(
                `INSERT INTO tarefa_checklist_itens (codigo, tarefa_codigo, texto, feito, ordem, responsavel_codigo)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [item.codigo, tarefa.codigo, item.texto, item.feito, ordem, item.responsavel?.codigo ?? null],
            );
        }
    }

    private async carregar(codigos: string[]): Promise<Tarefa[]> {
        if (codigos.length === 0) {
            return [];
        }

        // A entidade Tarefa guarda a predecessora inteira (dependeDe), não só o código. Por isso
        // a busca segue em ondas: cada volta traz as predecessoras que ainda não foram lidas.
        const linhas = new Map<string, any>();
        let pendentes = [...new Set(codigos)];

        while (pendentes.length > 0) {
            const encontradas = await this.conexao.consultar(`${SELECT_TAREFA} WHERE codigo = ANY($1::uuid[])`, [pendentes]);
            const proximos = new Set<string>();

            encontradas.forEach((linha) => {
                linhas.set(linha.codigo, linha);
            });
            encontradas.forEach((linha) => {
                if (linha.depende_de_codigo && !linhas.has(linha.depende_de_codigo)) {
                    proximos.add(linha.depende_de_codigo);
                }
            });

            pendentes = [...proximos];
        }

        const todos = [...linhas.keys()];

        const vinculos = await this.conexao.consultar(
            `SELECT tarefa_codigo, usuario_codigo
             FROM tarefa_responsaveis
             WHERE tarefa_codigo = ANY($1::uuid[])`,
            [todos],
        );

        const itens = await this.conexao.consultar(
            `SELECT codigo, tarefa_codigo, texto, feito, responsavel_codigo
             FROM tarefa_checklist_itens
             WHERE tarefa_codigo = ANY($1::uuid[])
             ORDER BY tarefa_codigo, ordem`,
            [todos],
        );

        const projetos = await carregarProjetos(this.conexao, [...linhas.values()].map((l) => l.projeto_codigo).filter(Boolean));

        const usuarios = await carregarUsuarios(this.conexao, [
            ...vinculos.map((v) => v.usuario_codigo),
            ...itens.map((i) => i.responsavel_codigo).filter(Boolean),
            ...[...linhas.values()].map((l) => l.concluida_por_codigo).filter(Boolean),
            ...[...linhas.values()].map((l) => l.criada_por_codigo).filter(Boolean),
        ]);

        // Cache: várias tarefas podem depender da mesma predecessora, que é montada uma vez só.
        const construidas = new Map<string, Tarefa>();

        const construir = (codigo: string): Tarefa => {
            const existente = construidas.get(codigo);
            if (existente) {
                return existente;
            }

            const linha = linhas.get(codigo);
            const dependeDe = linha.depende_de_codigo ? construir(linha.depende_de_codigo) : null;

            const responsaveis = vinculos.filter((v) => v.tarefa_codigo === codigo).map((v) => usuarios.get(v.usuario_codigo)!);

            const checklist = itens
                .filter((i) => i.tarefa_codigo === codigo)
                .map(
                    (i) =>
                        new ItemChecklistTarefa(
                            i.texto,
                            i.feito,
                            i.codigo,
                            i.responsavel_codigo ? (usuarios.get(i.responsavel_codigo) ?? null) : null,
                        ),
                );

            const projeto = projetos.get(linha.projeto_codigo)!;
            // Coluna não achada (dado estranho): o construtor cai na coluna que corresponde ao status.
            const coluna = projeto.colunas.find((c) => c.codigo === linha.coluna_codigo) ?? null;

            const tarefa = new Tarefa(
                projeto,
                linha.titulo,
                linha.data_inicio,
                linha.data_fim,
                linha.status as StatusTarefa,
                linha.prioridade as PrioridadeTarefa,
                linha.descricao,
                linha.data_conclusao,
                dependeDe,
                responsaveis,
                checklist,
                linha.codigo,
                linha.concluida_por_codigo ? (usuarios.get(linha.concluida_por_codigo) ?? null) : null,
                linha.criada_por_codigo ? (usuarios.get(linha.criada_por_codigo) ?? null) : null,
                coluna,
                (linha.dificuldade as DificuldadeTarefa | null) ?? null,
            );

            construidas.set(codigo, tarefa);
            return tarefa;
        };

        return codigos.filter((codigo) => linhas.has(codigo)).map(construir);
    }
}
