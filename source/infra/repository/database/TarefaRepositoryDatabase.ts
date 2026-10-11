import Tarefa from "../../../domain/Entity/Tarefa";
import ItemChecklistTarefa from "../../../domain/Entity/ItemChecklistTarefa";
import StatusTarefa from "../../../domain/Enum/StatusTarefa";
import PrioridadeTarefa from "../../../domain/Enum/PrioridadeTarefa";
import TarefaRepositoryInterface from "../../../domain/Interfaces/TarefaRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql, dataParaSqlOuNulo } from "../../database/conversoes";
import { carregarProjetos, carregarUsuarios } from "./carregadores";

const SELECT_TAREFA = `
    SELECT codigo, projeto_codigo, titulo, descricao, data_inicio, data_fim,
           status, prioridade, data_conclusao, depende_de_codigo
    FROM tarefas
`;

export default class TarefaRepositoryDatabase implements TarefaRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(tarefa: Tarefa): Promise<Tarefa> {
        await this.conexao.transacao(async (conexao) => {
            await conexao.consultar(
                `INSERT INTO tarefas (codigo, projeto_codigo, titulo, descricao, data_inicio,
                                      data_fim, status, prioridade, data_conclusao, depende_de_codigo)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
                ],
            );
            await this.gravarRelacionamentos(conexao, tarefa);
        });

        return tarefa;
    }

    async listar(): Promise<Tarefa[]> {
        const linhas = await this.conexao.consultar(
            "SELECT codigo FROM tarefas ORDER BY data_fim, prioridade",
        );
        return this.carregar(linhas.map((l) => l.codigo));
    }

    async listarPorProjeto(codigoProjeto: string): Promise<Tarefa[]> {
        const linhas = await this.conexao.consultar(
            "SELECT codigo FROM tarefas WHERE projeto_codigo = $1 ORDER BY data_fim, prioridade",
            [codigoProjeto],
        );
        return this.carregar(linhas.map((l) => l.codigo));
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
            const linhas = await conexao.consultar(
                `UPDATE tarefas
                 SET titulo = $2, descricao = $3, data_inicio = $4, data_fim = $5,
                     status = $6, prioridade = $7, data_conclusao = $8, depende_de_codigo = $9
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
                ],
            );

            if (linhas.length === 0) {
                throw new Error("Tarefa não encontrada");
            }

            await conexao.consultar(
                "DELETE FROM tarefa_responsaveis WHERE tarefa_codigo = $1",
                [tarefa.codigo],
            );
            await conexao.consultar(
                "DELETE FROM tarefa_checklist_itens WHERE tarefa_codigo = $1",
                [tarefa.codigo],
            );
            await this.gravarRelacionamentos(conexao, tarefa);
        });

        return tarefa;
    }

    async excluir(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar(
            "DELETE FROM tarefas WHERE codigo = $1 RETURNING codigo",
            [codigo],
        );

        if (linhas.length === 0) {
            throw new Error("Tarefa não encontrada");
        }
    }

    async excluirPorProjeto(codigoProjeto: string): Promise<void> {
        await this.conexao.consultar(
            "DELETE FROM tarefas WHERE projeto_codigo = $1",
            [codigoProjeto],
        );
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
                `INSERT INTO tarefa_checklist_itens (codigo, tarefa_codigo, texto, feito, ordem)
                 VALUES ($1, $2, $3, $4, $5)`,
                [item.codigo, tarefa.codigo, item.texto, item.feito, ordem],
            );
        }
    }

    private async carregar(codigos: string[]): Promise<Tarefa[]> {
        if (codigos.length === 0) {
            return [];
        }

        const linhas = new Map<string, any>();
        let pendentes = [...new Set(codigos)];

        while (pendentes.length > 0) {
            const encontradas = await this.conexao.consultar(
                `${SELECT_TAREFA} WHERE codigo = ANY($1::uuid[])`,
                [pendentes],
            );
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
            `SELECT codigo, tarefa_codigo, texto, feito
             FROM tarefa_checklist_itens
             WHERE tarefa_codigo = ANY($1::uuid[])
             ORDER BY ordem`,
            [todos],
        );

        const projetos = await carregarProjetos(
            this.conexao,
            [...linhas.values()].map((l) => l.projeto_codigo),
        );

        const usuarios = await carregarUsuarios(
            this.conexao,
            vinculos.map((v) => v.usuario_codigo),
        );

        const construidas = new Map<string, Tarefa>();

        const construir = (codigo: string): Tarefa => {
            const existente = construidas.get(codigo);
            if (existente) {
                return existente;
            }

            const linha = linhas.get(codigo);
            const dependeDe = linha.depende_de_codigo
                ? construir(linha.depende_de_codigo)
                : null;

            const responsaveis = vinculos
                .filter((v) => v.tarefa_codigo === codigo)
                .map((v) => usuarios.get(v.usuario_codigo)!);

            const checklist = itens
                .filter((i) => i.tarefa_codigo === codigo)
                .map((i) => new ItemChecklistTarefa(i.texto, i.feito, i.codigo));

            const tarefa = new Tarefa(
                projetos.get(linha.projeto_codigo)!,
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
            );

            construidas.set(codigo, tarefa);
            return tarefa;
        };

        return codigos.filter((codigo) => linhas.has(codigo)).map(construir);
    }
}
