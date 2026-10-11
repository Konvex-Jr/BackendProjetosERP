import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import Projeto from "./Projeto";
import Usuario from "./Usuario";
import ItemChecklistTarefa from "./ItemChecklistTarefa";
import StatusTarefa from "../Enum/StatusTarefa";
import PrioridadeTarefa from "../Enum/PrioridadeTarefa";

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

        this.validar();
    }

    /** Atrasada = não concluída e com prazo anterior a "hoje". */
    estaAtrasada(hoje: Date): boolean {
        return (
            this.status !== StatusTarefa.CONCLUIDA &&
            this.dataFim.getTime() < hoje.getTime()
        );
    }

    private validar(): void {
        if (!this.titulo.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "TITULO_TAREFA_OBRIGATORIO",
            );
        }

        if (
            Number.isNaN(this.dataInicio.getTime()) ||
            Number.isNaN(this.dataFim.getTime())
        ) {
            throw new ErroValidacao(
                "As datas da tarefa devem ser válidas.",
                "DATA_TAREFA_INVALIDA",
            );
        }

        if (this.dataFim.getTime() < this.dataInicio.getTime()) {
            throw new ErroValidacao(
                "O prazo não pode ser anterior à data de início da tarefa.",
                "PERIODO_TAREFA_INVALIDO",
            );
        }

        if (
            this.status === StatusTarefa.CONCLUIDA &&
            this.dataConclusao === null
        ) {
            throw new ErroValidacao(
                "Tarefa concluída deve ter data de conclusão.",
                "DATA_CONCLUSAO_OBRIGATORIA",
            );
        }

        if (
            this.status !== StatusTarefa.CONCLUIDA &&
            this.dataConclusao !== null
        ) {
            throw new ErroValidacao(
                "Somente tarefas concluídas podem ter data de conclusão.",
                "DATA_CONCLUSAO_INCOMPATIVEL",
            );
        }

        if (this.dependeDe) {
            if (this.dependeDe.codigo === this.codigo) {
                throw new ErroValidacao(
                    "Uma tarefa não pode depender dela mesma.",
                    "DEPENDENCIA_CIRCULAR",
                );
            }

            if (this.dependeDe.projeto.codigo !== this.projeto.codigo) {
                throw new ErroValidacao(
                    "A tarefa predecessora deve pertencer ao mesmo projeto.",
                    "DEPENDENCIA_OUTRO_PROJETO",
                );
            }
        }

        const codigosResponsaveis = this.responsaveis.map((r) => r.codigo);
        if (new Set(codigosResponsaveis).size !== codigosResponsaveis.length) {
            throw new ErroValidacao(
                "A tarefa não pode ter responsáveis duplicados.",
                "RESPONSAVEL_DUPLICADO_TAREFA",
            );
        }

        const codigosMembros = new Set(
            this.projeto.membros.map((membro) => membro.codigo),
        );
        if (!codigosResponsaveis.every((codigo) => codigosMembros.has(codigo))) {
            throw new ErroValidacao(
                "Os responsáveis devem ser membros do projeto.",
                "RESPONSAVEL_FORA_DO_PROJETO",
            );
        }
    }
}
