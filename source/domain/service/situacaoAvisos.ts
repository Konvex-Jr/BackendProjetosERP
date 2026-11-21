import Capacitacao from "../entity/Capacitacao";
import Tarefa from "../entity/Tarefa";
import StatusProjeto from "../enum/StatusProjeto";
import StatusTarefa from "../enum/StatusTarefa";
import { noDia } from "./ocupacao";

const DIA = 24 * 60 * 60 * 1000;

export interface TarefaDoAviso {
    codigo: string;
    titulo: string;
    dataFim: string;
    projeto: { codigo: string; nome: string };
}

/** Forma mínima do resumo de ocupação (igual a `OcupacaoResumo`), para o domínio não depender dos casos de uso. */
export interface OcupacaoDaPessoa {
    codigoUsuario: string;
    nome: string;
    percentual: number;
}

export type ItemSituacao =
    | { tipo: "tarefas_atrasadas"; tarefas: TarefaDoAviso[] }
    | { tipo: "tarefas_a_vencer"; tarefas: TarefaDoAviso[] }
    | { tipo: "capacitacao_proxima"; capacitacao: { codigo: string; titulo: string; data: string; hora: string } }
    | { tipo: "sobrecarga"; pessoas: { codigoUsuario: string; nome: string; percentual: number }[] };

const iso = (d: Date) => noDia(d).toISOString().slice(0, 10);

export function tarefaDoAviso(t: Tarefa): TarefaDoAviso {
    return { codigo: t.codigo, titulo: t.titulo, dataFim: iso(t.dataFim), projeto: { codigo: t.projeto.codigo, nome: t.projeto.nome } };
}

/** Situação da pessoa na leitura: atrasadas, a vencer (hoje e amanhã), capacitações (hoje e amanhã) e, para a gestão, sobrecarga. */
export function calcularSituacao(e: {
    codigoUsuario: string;
    hoje: Date;
    tarefas: Tarefa[];
    capacitacoes: Capacitacao[];
    ocupacao: OcupacaoDaPessoa[] | null;
}): ItemSituacao[] {
    const hojeDia = noDia(e.hoje).getTime();
    const amanha = hojeDia + DIA;
    const minhas = e.tarefas.filter(
        (t) =>
            t.status !== StatusTarefa.CONCLUIDA &&
            t.projeto.status !== StatusProjeto.CONCLUIDO &&
            t.projeto.status !== StatusProjeto.ARQUIVADO &&
            t.responsaveis.some((r) => r.codigo === e.codigoUsuario),
    );
    const fim = (t: Tarefa) => noDia(t.dataFim).getTime();
    const porPrazo = (a: Tarefa, b: Tarefa) => fim(a) - fim(b);
    const atrasadas = minhas.filter((t) => fim(t) < hojeDia).sort(porPrazo);
    const aVencer = minhas.filter((t) => fim(t) >= hojeDia && fim(t) <= amanha).sort(porPrazo);

    const itens: ItemSituacao[] = [];
    if (atrasadas.length) itens.push({ tipo: "tarefas_atrasadas", tarefas: atrasadas.map(tarefaDoAviso) });
    if (aVencer.length) itens.push({ tipo: "tarefas_a_vencer", tarefas: aVencer.map(tarefaDoAviso) });
    for (const c of e.capacitacoes) {
        const dia = noDia(c.data).getTime();
        if (dia < hojeDia || dia > amanha || !c.inscricaoDe(e.codigoUsuario)) continue;
        itens.push({ tipo: "capacitacao_proxima", capacitacao: { codigo: c.codigo, titulo: c.titulo, data: iso(c.data), hora: c.hora } });
    }
    const sobrecarregadas = (e.ocupacao ?? []).filter((o) => o.percentual > 100).sort((a, b) => b.percentual - a.percentual);
    if (sobrecarregadas.length) {
        itens.push({
            tipo: "sobrecarga",
            pessoas: sobrecarregadas.map((o) => ({ codigoUsuario: o.codigoUsuario, nome: o.nome, percentual: o.percentual })),
        });
    }
    return itens;
}
