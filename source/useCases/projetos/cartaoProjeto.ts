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
    geralDaArea: boolean;
    /** Equipe atual (sessão 27b): só código, nome e foto; sem função nem ex-membros. */
    membros: { codigo: string; nome: string; foto: string | null }[];
    /** % de tarefas concluídas (sessão 31b), arredondado; 0 sem tarefas. Só o número, sem as contagens. */
    progresso: number;
    /** Classe do projeto (sessão 31b), nome só. */
    classe: string | null;
    cartao: true;
}

/**
 * O que quem não vê o projeto completo enxerga (sessão 27a): só que ele existe. Lista fechada, montada
 * campo a campo (nunca espalhar o projeto): datas, tarefas, cliente, descrição, referência, ex-membros,
 * funções e colunas não saem daqui. A equipe atual sai desde a sessão 27b (nome e foto).
 */
export function cartaoProjeto(
    projeto: Projeto,
    tarefas: { total: number; concluidas: number } = { total: 0, concluidas: 0 },
): CartaoProjeto {
    const area = projeto.tipo === TipoProjeto.INTERNO && projeto.area ? { codigo: projeto.area.codigo, nome: projeto.area.nome } : null;
    const lider = projeto.lider ? { codigo: projeto.lider.codigo, nome: projeto.lider.nome } : null;
    return {
        codigo: projeto.codigo,
        nome: projeto.nome,
        tipo: projeto.tipo,
        area,
        status: projeto.status,
        lider,
        geralDaArea: projeto.geralDaArea,
        membros: projeto.membros.map((m) => ({ codigo: m.codigo, nome: m.nome, foto: m.foto })),
        progresso: tarefas.total ? Math.round((tarefas.concluidas / tarefas.total) * 100) : 0,
        classe: projeto.classe?.nome ?? null,
        cartao: true,
    };
}
