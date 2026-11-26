import DificuldadeTarefa from "../enum/DificuldadeTarefa";
import { TETO_SEM_CARGO } from "../entity/Cargo";

const DIA = 24 * 60 * 60 * 1000;

export interface TarefaParaOcupacao {
    codigo: string;
    dataInicio: Date;
    dataFim: Date;
    concluida: boolean;
    projetoAtivo: boolean;
    dificuldade: DificuldadeTarefa | null;
    responsaveis: string[];
}

export interface OcupacaoPessoa {
    codigoUsuario: string;
    horas: number;
    teto: number;
    percentual: number;
    tarefas: Array<{ codigo: string; horas: number }>;
}

/**
 * O dia (meia-noite UTC) de uma data. No sistema, data sem hora já é meia-noite UTC do dia de São Paulo;
 * isto só descarta uma hora que tenha sobrado (ex.: meio-dia local vindo da tela), para nunca perder um dia na conta.
 */
export function noDia(data: Date): Date {
    return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

/** Segunda-feira da semana do dia (todas as datas são meia-noite UTC do dia de São Paulo). */
export function segundaDaSemana(dia: Date): Date {
    const d = noDia(dia);
    const deslocamento = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - deslocamento * DIA);
}

/** Dias úteis da semana (segunda) a partir de hoje, contando hoje; ao menos 1 (fim de semana conta como 1 dia). */
function diasRestantesDaSemana(hoje: Date): number {
    const diaSemana = hoje.getUTCDay();
    if (diaSemana === 0 || diaSemana === 6) return 1;
    return 6 - diaSemana;
}

/**
 * Dias úteis da tarefa que caem na semana que começa em `segunda` (desde 25/11 a dificuldade é % do dia, então a
 * ocupação conta dias, não um total de horas). Atrasada: os dias úteis que restam na semana atual. Tarefa só no
 * fim de semana: 1 dia, na semana da sexta anterior.
 */
export function diasNaSemana(t: TarefaParaOcupacao, segundaInformada: Date, hojeInformado: Date): number {
    if (t.concluida || !t.projetoAtivo || t.dificuldade === null) return 0;
    const hoje = noDia(hojeInformado);
    const segunda = segundaDaSemana(segundaInformada);
    const dataInicio = noDia(t.dataInicio);
    const dataFim = noDia(t.dataFim);
    const semanaDeHoje = segundaDaSemana(hoje).getTime();
    if (dataFim.getTime() < hoje.getTime()) {
        return segunda.getTime() === semanaDeHoje ? diasRestantesDaSemana(hoje) : 0;
    }
    const inicio = segunda.getTime();
    const fim = inicio + 4 * DIA;
    let uteis = 0;
    let dentro = 0;
    for (let ms = dataInicio.getTime(); ms <= dataFim.getTime(); ms += DIA) {
        const diaSemana = new Date(ms).getUTCDay();
        if (diaSemana < 1 || diaSemana > 5) continue;
        uteis++;
        if (ms >= inicio && ms <= fim) dentro++;
    }
    if (uteis === 0) {
        const diaInicio = dataInicio.getUTCDay();
        const sexta = dataInicio.getTime() - (diaInicio === 0 ? 2 : diaInicio === 6 ? 1 : 0) * DIA;
        return segundaDaSemana(new Date(sexta)).getTime() === segunda.getTime() ? 1 : 0;
    }
    return dentro;
}

const arredondar = (n: number) => Math.round(n * 10) / 10;

/**
 * Ocupação de cada pessoa na semana. Cada nível de dificuldade é uma parte do dia da pessoa (`percentuais`, ex.:
 * Difícil = 100%); o dia vale o teto semanal ÷ 5. Horas de uma tarefa na semana = dias × % do nível × teto ÷ 5,
 * para cada responsável (cada um com o próprio teto).
 */
export function calcularOcupacao(
    tarefas: TarefaParaOcupacao[],
    percentuais: Record<DificuldadeTarefa, number>,
    tetos: Map<string, number>,
    codigosUsuarios: string[],
    segunda: Date,
    hoje: Date,
): OcupacaoPessoa[] {
    const porPessoa = new Map<string, Array<{ codigo: string; horas: number }>>();
    for (const c of codigosUsuarios) porPessoa.set(c, []);
    const tetoDe = (c: string) => tetos.get(c) ?? TETO_SEM_CARGO;
    for (const t of tarefas) {
        if (t.dificuldade === null) continue;
        const dias = diasNaSemana(t, segunda, hoje);
        if (dias <= 0) continue;
        const parteDoDia = percentuais[t.dificuldade] / 100;
        for (const r of t.responsaveis) porPessoa.get(r)?.push({ codigo: t.codigo, horas: (dias * parteDoDia * tetoDe(r)) / 5 });
    }
    return codigosUsuarios.map((codigoUsuario) => {
        const itens = porPessoa.get(codigoUsuario) ?? [];
        const soma = itens.reduce((s, i) => s + i.horas, 0);
        const teto = tetoDe(codigoUsuario);
        return {
            codigoUsuario,
            horas: arredondar(soma),
            teto,
            percentual: Math.round((soma / teto) * 100),
            tarefas: itens.map((i) => ({ codigo: i.codigo, horas: arredondar(i.horas) })),
        };
    });
}
