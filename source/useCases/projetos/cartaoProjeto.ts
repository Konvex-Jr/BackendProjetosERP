import Projeto from "../../domain/entity/Projeto";
import StatusProjeto from "../../domain/enum/StatusProjeto";
import TipoProjeto from "../../domain/enum/TipoProjeto";

export interface CartaoProjeto {
    codigo: string;
    nome: string;
    tipo: TipoProjeto;
    /** Só nos projetos internos; no cliente, nulo. */
    area: { codigo: string; nome: string } | null;
    status: StatusProjeto;
    lider: { codigo: string; nome: string } | null;
    sigiloso: boolean;
    geralDaArea: boolean;
    cartao: true;
}

/**
 * O que quem não vê o projeto completo enxerga (sessão 27a): só que ele existe. Lista fechada, montada
 * campo a campo (nunca espalhar o projeto): datas, tarefas, cliente, descrição, referência, equipe,
 * funções e colunas não saem daqui.
 */
export function cartaoProjeto(projeto: Projeto): CartaoProjeto {
    const area = projeto.tipo === TipoProjeto.INTERNO && projeto.area ? { codigo: projeto.area.codigo, nome: projeto.area.nome } : null;
    const lider = projeto.lider ? { codigo: projeto.lider.codigo, nome: projeto.lider.nome } : null;
    return {
        codigo: projeto.codigo,
        nome: projeto.nome,
        tipo: projeto.tipo,
        area,
        status: projeto.status,
        lider,
        sigiloso: projeto.sigiloso,
        geralDaArea: projeto.geralDaArea,
        cartao: true,
    };
}
