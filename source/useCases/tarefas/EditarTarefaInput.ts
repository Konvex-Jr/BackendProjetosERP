import StatusTarefa from "../../domain/enum/StatusTarefa";
import PrioridadeTarefa from "../../domain/enum/PrioridadeTarefa";
import DificuldadeTarefa from "../../domain/enum/DificuldadeTarefa";
import Usuario from "../../domain/entity/Usuario";
export default interface EditarTarefaInput {
    codigo: string;
    titulo: string;
    dataInicio: Date;
    dataFim: Date;
    status: StatusTarefa;
    prioridade: PrioridadeTarefa;
    /** Se vier, a coluna vale mais que o `status`. */
    codigoColuna?: string | null;
    descricao?: string | null;
    /** Ausente mantém a atual; null limpa. */
    dificuldade?: DificuldadeTarefa | null;
    codigosResponsaveis: string[];
    /** Verdadeiro: ignora `codigosResponsaveis` e mantém os atuais (quem edita sem organizar). */
    manterResponsaveis?: boolean;
    /** Verdadeiro: ignora status e coluna e mantém a situação atual (quem edita sem poder mudar status). */
    manterSituacao?: boolean;
    /** Corrige a data de conclusão. Só vale se a tarefa segue concluída e `manterSituacao` é falso; ausente mantém. */
    dataConclusao?: Date | null;
    codigoDependencia?: string | null;
    checklist?: EditarTarefaChecklistInput[];
    /** Quem está editando; vira `concluidaPor` se a edição concluir a tarefa. */
    quem?: Usuario | null;
}

export interface EditarTarefaChecklistInput {
    codigo?: string;
    texto: string;
    /** Só vale ao criar. Ao editar, o `feito` de item que já existe vem do banco e item novo nasce não feito. */
    feito?: boolean;
    /** Ausente em item que já existe mantém o responsável; null tira. Tem que ser responsável da tarefa. */
    codigoResponsavel?: string | null;
}
