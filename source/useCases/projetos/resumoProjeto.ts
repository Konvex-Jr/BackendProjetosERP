import Projeto from "../../domain/entity/Projeto";
import StatusProjeto from "../../domain/enum/StatusProjeto";
import { ContagemTarefas } from "../../domain/interfaces/TarefaRepositoryInterface";

export interface ResumoProjeto {
    codigo: string;
    nome: string;
    sigiloso: true;
    resumo: true;
    tipo: Projeto["tipo"];
    status: StatusProjeto;
    dataInicio: Date;
    dataFim: Date;
    tarefas: ContagemTarefas;
    participacoes: {
        usuario: { codigo: string; nome: string };
        alocacao: number;
        ativa: boolean;
        dataEntrada: Date;
        dataSaida: Date | null;
    }[];
}

/**
 * O que o gerente fora de um projeto sigiloso enxerga: só o andamento. Lista fechada, montada campo a
 * campo (nunca espalhar o projeto): cliente, descrição, referência e função não saem daqui.
 */
export function resumoProjeto(projeto: Projeto, tarefas: ContagemTarefas): ResumoProjeto {
    return {
        codigo: projeto.codigo,
        nome: projeto.nome,
        sigiloso: true,
        resumo: true,
        tipo: projeto.tipo,
        status: projeto.status,
        dataInicio: projeto.dataInicio,
        dataFim: projeto.dataFim,
        tarefas,
        participacoes: projeto.participacoes.map((p) => ({
            usuario: { codigo: p.usuario.codigo, nome: p.usuario.nome },
            alocacao: p.alocacao,
            ativa: p.ativa,
            dataEntrada: p.dataEntrada,
            dataSaida: p.dataSaida,
        })),
    };
}
