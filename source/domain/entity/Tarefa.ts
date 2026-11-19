import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import Projeto from "./Projeto";
import Usuario from "./Usuario";
import ItemChecklistTarefa from "./ItemChecklistTarefa";
import StatusTarefa from "../enum/StatusTarefa";
import PrioridadeTarefa from "../enum/PrioridadeTarefa";
import ColunaProjeto from "./ColunaProjeto";
import { statusDoPapel, PapelColuna } from "../enum/ColunaProjeto";

/**
 * Tarefa de projeto (toda tarefa tem projeto desde a sessão 23b). Como as outras entidades,
 * é imutável e se valida no construtor; mudar algo gera uma cópia (comStatus, semDependencia...).
 * Quem pode ver e alterar fica em shared/seguranca/regrasTarefa.ts.
 */
export default class Tarefa {
    readonly codigo: string;
    readonly projeto: Projeto;
    readonly titulo: string;
    readonly dataInicio: Date;
    readonly dataFim: Date;
    readonly status: StatusTarefa;
    readonly prioridade: PrioridadeTarefa;
    readonly descricao: string | null;
    readonly dataConclusao: Date | null;
    readonly dependeDe: Tarefa | null;
    readonly responsaveis: Usuario[];
    readonly checklist: ItemChecklistTarefa[];
    /** Quem concluiu (sessão 8b). Nulo se não concluída ou concluída antes do registro existir. */
    readonly concluidaPor: Usuario | null;
    /** Quem criou (sessão 8c). Nulo nas tarefas criadas antes. */
    readonly criadaPor: Usuario | null;
    /** Coluna do kanban do projeto (sessão 21). O status vem do papel dela. */
    readonly coluna: ColunaProjeto;

    constructor(
        projeto: Projeto,
        titulo: string,
        dataInicio: Date,
        dataFim: Date,
        status: StatusTarefa = StatusTarefa.PENDENTE,
        prioridade: PrioridadeTarefa = PrioridadeTarefa.P3,
        descricao: string | null = null,
        dataConclusao: Date | null = null,
        dependeDe: Tarefa | null = null,
        responsaveis: Usuario[] = [],
        checklist: ItemChecklistTarefa[] = [],
        codigo?: string,
        concluidaPor: Usuario | null = null,
        criadaPor: Usuario | null = null,
        coluna: ColunaProjeto | null = null,
    ) {
        if (!projeto) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.PROJETO_OBRIGATORIO, "PROJETO_OBRIGATORIO");
        }
        // Sem coluna, o status escolhe a coluna: um status inválido não pode virar "andamento" em silêncio.
        if (coluna === null && !Object.values(StatusTarefa).includes(status)) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.STATUS_INVALIDO, "STATUS_TAREFA_INVALIDO");
        }
        // A coluna manda e o status é o do papel dela (o status passado só escolhe a coluna).
        const colunaFinal = coluna ?? projeto.colunaParaStatus(status);
        status = statusDoPapel(colunaFinal.papel);

        this.codigo = codigo ?? uuid();
        this.projeto = projeto;
        this.titulo = titulo;
        this.dataInicio = dataInicio;
        this.dataFim = dataFim;
        this.status = status;
        this.prioridade = prioridade;
        this.descricao = descricao;
        this.dataConclusao = dataConclusao;
        this.dependeDe = dependeDe;
        this.responsaveis = responsaveis;
        this.checklist = checklist;
        // Reabrir a tarefa apaga quem concluiu.
        this.concluidaPor = status === StatusTarefa.CONCLUIDA ? concluidaPor : null;
        this.criadaPor = criadaPor;
        this.coluna = colunaFinal;

        this.validar();
    }

    /** Cópia com outro status/conclusão, mantendo o resto. */
    comStatus(status: StatusTarefa, dataConclusao: Date | null, concluidaPor: Usuario | null): Tarefa {
        // Status inválido segue sem coluna: o construtor recusa com STATUS_TAREFA_INVALIDO.
        const statusValido = Object.values(StatusTarefa).includes(status);
        return new Tarefa(
            this.projeto,
            this.titulo,
            this.dataInicio,
            this.dataFim,
            status,
            this.prioridade,
            this.descricao,
            dataConclusao,
            this.dependeDe,
            this.responsaveis,
            this.checklist,
            this.codigo,
            concluidaPor,
            this.criadaPor,
            // Mantém a coluna se ela já serve ao novo status; senão, a que corresponde a ele.
            statusValido ? this.projeto.colunaParaStatus(status, this.coluna) : null,
        );
    }

    /**
     * Cópia na coluna dada (só tarefa de projeto): o status vem do papel dela. Entrar na concluída
     * registra data e autor; já estar concluída mantém os dois; sair apaga os dois.
     */
    naColuna(coluna: ColunaProjeto, hoje: Date, quem: Usuario | null): Tarefa {
        const concluida = coluna.papel === PapelColuna.CONCLUIDA;
        const jaConcluida = this.status === StatusTarefa.CONCLUIDA;
        return new Tarefa(
            this.projeto,
            this.titulo,
            this.dataInicio,
            this.dataFim,
            statusDoPapel(coluna.papel),
            this.prioridade,
            this.descricao,
            concluida ? (jaConcluida ? this.dataConclusao : hoje) : null,
            this.dependeDe,
            this.responsaveis,
            this.checklist,
            this.codigo,
            concluida ? (jaConcluida ? this.concluidaPor : quem) : null,
            this.criadaPor,
            coluna,
        );
    }

    /** Conclusão e status andam juntos. Conferido ao criar e editar, nunca ao ler do banco. */
    exigirConclusaoCoerente(): void {
        if (this.status === StatusTarefa.CONCLUIDA && this.dataConclusao === null) {
            throw new ErroValidacao("Tarefa concluída deve ter data de conclusão.", "DATA_CONCLUSAO_OBRIGATORIA");
        }

        if (this.status !== StatusTarefa.CONCLUIDA && this.dataConclusao !== null) {
            throw new ErroValidacao("Somente tarefas concluídas podem ter data de conclusão.", "DATA_CONCLUSAO_INCOMPATIVEL");
        }
    }

    /** Cópia sem a predecessora (quando ela é excluída). */
    semDependencia(): Tarefa {
        return new Tarefa(
            this.projeto,
            this.titulo,
            this.dataInicio,
            this.dataFim,
            this.status,
            this.prioridade,
            this.descricao,
            this.dataConclusao,
            null,
            this.responsaveis,
            this.checklist,
            this.codigo,
            this.concluidaPor,
            this.criadaPor,
            this.coluna,
        );
    }

    toJSON() {
        // As colunas já vêm em `coluna`; não repetir a lista inteira dentro de `projeto`.
        const projeto: Record<string, unknown> = { ...this.projeto.toJSON() };
        delete projeto.colunas;
        return { ...this, projeto, coluna: this.coluna.toJSON() };
    }

    /** Atrasada = não concluída e com prazo anterior a "hoje". */
    estaAtrasada(hoje: Date): boolean {
        return this.status !== StatusTarefa.CONCLUIDA && this.dataFim.getTime() < hoje.getTime();
    }

    private validar(): void {
        if (!this.titulo.trim()) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.TITULO_OBRIGATORIO, "TITULO_TAREFA_OBRIGATORIO");
        }

        if (!Object.values(PrioridadeTarefa).includes(this.prioridade)) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.PRIORIDADE_INVALIDA, "PRIORIDADE_TAREFA_INVALIDA");
        }

        if (!Object.values(StatusTarefa).includes(this.status)) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.STATUS_INVALIDO, "STATUS_TAREFA_INVALIDO");
        }

        if (Number.isNaN(this.dataInicio.getTime()) || Number.isNaN(this.dataFim.getTime())) {
            throw new ErroValidacao("As datas da tarefa devem ser válidas.", "DATA_TAREFA_INVALIDA");
        }

        if (this.dataFim.getTime() < this.dataInicio.getTime()) {
            throw new ErroValidacao("O prazo não pode ser anterior à data de início da tarefa.", "PERIODO_TAREFA_INVALIDO");
        }

        if (this.dependeDe) {
            if (this.dependeDe.codigo === this.codigo) {
                throw new ErroValidacao("Uma tarefa não pode depender dela mesma.", "DEPENDENCIA_CIRCULAR");
            }

            if (this.dependeDe.projeto?.codigo !== this.projeto.codigo) {
                throw new ErroValidacao("A tarefa predecessora deve pertencer ao mesmo projeto.", "DEPENDENCIA_OUTRO_PROJETO");
            }
        }

        const codigosResponsaveis = this.responsaveis.map((r) => r.codigo);
        if (new Set(codigosResponsaveis).size !== codigosResponsaveis.length) {
            throw new ErroValidacao("A tarefa não pode ter responsáveis duplicados.", "RESPONSAVEL_DUPLICADO_TAREFA");
        }

        // "Responsável na equipe do projeto" não é conferido aqui: a entidade também é montada ao
        // ler do banco, e quem saiu da equipe continua responsável pelas tarefas antigas. A regra
        // vale só ao criar e editar (CriarTarefa e EditarTarefa).
    }
}
