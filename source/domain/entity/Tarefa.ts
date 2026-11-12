import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import Projeto from "./Projeto";
import Usuario from "./Usuario";
import ItemChecklistTarefa from "./ItemChecklistTarefa";
import StatusTarefa from "../enum/StatusTarefa";
import PrioridadeTarefa from "../enum/PrioridadeTarefa";
import CategoriaTarefa, { ehCategoriaTarefa } from "../enum/CategoriaTarefa";
import { Referencia } from "./Conhecimento";

/**
 * Tarefa de projeto ou avulsa: tem projeto ou categoria, nunca os dois. Como as outras entidades,
 * é imutável e se valida no construtor; mudar algo gera uma cópia (comStatus, semDependencia...).
 * Quem pode ver e alterar fica em shared/seguranca/regrasTarefa.ts.
 */
export default class Tarefa {
    readonly codigo: string;
    /** Projeto da tarefa; nulo na tarefa avulsa (sessão 8c), que tem `categoria`. */
    readonly projeto: Projeto | null;
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
    /** Só em tarefa avulsa: Inovação, Capacitação ou Execução (sessão 8c). */
    readonly categoria: CategoriaTarefa | null;
    /** Quem criou (sessão 8c). Nulo nas tarefas criadas antes. */
    readonly criadaPor: Usuario | null;
    /** Iniciativa de inovação ligada (sessão 12b). Só em tarefa avulsa de categoria Inovação. */
    readonly iniciativa: Referencia | null;

    constructor(
        projeto: Projeto | null,
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
        categoria: CategoriaTarefa | null = null,
        criadaPor: Usuario | null = null,
        iniciativa: Referencia | null = null,
    ) {
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
        this.categoria = categoria ?? null;
        this.criadaPor = criadaPor;
        this.iniciativa = iniciativa ?? null;

        this.validar();
    }

    get avulsa(): boolean {
        return this.projeto === null;
    }

    /** Cópia com outro status/conclusão, mantendo o resto. */
    comStatus(status: StatusTarefa, dataConclusao: Date | null, concluidaPor: Usuario | null): Tarefa {
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
            this.categoria,
            this.criadaPor,
            this.iniciativa,
        );
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
            this.categoria,
            this.criadaPor,
            this.iniciativa,
        );
    }

    /** Cópia ligada a outra iniciativa (ou a nenhuma). */
    comIniciativa(iniciativa: Referencia | null): Tarefa {
        return new Tarefa(
            this.projeto,
            this.titulo,
            this.dataInicio,
            this.dataFim,
            this.status,
            this.prioridade,
            this.descricao,
            this.dataConclusao,
            this.dependeDe,
            this.responsaveis,
            this.checklist,
            this.codigo,
            this.concluidaPor,
            this.categoria,
            this.criadaPor,
            iniciativa,
        );
    }

    toJSON() {
        return { ...this, avulsa: this.avulsa };
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

        if (this.status === StatusTarefa.CONCLUIDA && this.dataConclusao === null) {
            throw new ErroValidacao("Tarefa concluída deve ter data de conclusão.", "DATA_CONCLUSAO_OBRIGATORIA");
        }

        if (this.status !== StatusTarefa.CONCLUIDA && this.dataConclusao !== null) {
            throw new ErroValidacao("Somente tarefas concluídas podem ter data de conclusão.", "DATA_CONCLUSAO_INCOMPATIVEL");
        }

        if ((this.projeto === null) === (this.categoria === null)) {
            throw new ErroValidacao("A tarefa precisa ter um projeto ou uma categoria (e não os dois).", "TAREFA_PROJETO_OU_CATEGORIA");
        }

        if (this.categoria !== null && !ehCategoriaTarefa(this.categoria)) {
            throw new ErroValidacao("Categoria inválida. Use inovacao, capacitacao ou execucao.", "CATEGORIA_TAREFA_INVALIDA");
        }

        if (this.iniciativa && this.categoria !== CategoriaTarefa.INOVACAO) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.INICIATIVA.SO_EM_INOVACAO, "INICIATIVA_SO_EM_INOVACAO");
        }

        if (this.dependeDe) {
            if (this.dependeDe.codigo === this.codigo) {
                throw new ErroValidacao("Uma tarefa não pode depender dela mesma.", "DEPENDENCIA_CIRCULAR");
            }

            if (!this.projeto || this.dependeDe.projeto?.codigo !== this.projeto.codigo) {
                throw new ErroValidacao("A tarefa predecessora deve pertencer ao mesmo projeto.", "DEPENDENCIA_OUTRO_PROJETO");
            }
        }

        const codigosResponsaveis = this.responsaveis.map((r) => r.codigo);
        if (new Set(codigosResponsaveis).size !== codigosResponsaveis.length) {
            throw new ErroValidacao("A tarefa não pode ter responsáveis duplicados.", "RESPONSAVEL_DUPLICADO_TAREFA");
        }

        // Em tarefa avulsa, qualquer pessoa ativa pode ser responsável (o caso de uso confere).
        if (!this.projeto) return;
        const codigosMembros = new Set(this.projeto.membros.map((membro) => membro.codigo));
        if (!codigosResponsaveis.every((codigo) => codigosMembros.has(codigo))) {
            throw new ErroValidacao("Os responsáveis devem ser membros do projeto.", "RESPONSAVEL_FORA_DO_PROJETO");
        }
    }
}
