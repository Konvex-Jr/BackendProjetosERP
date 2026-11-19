import DificuldadeTarefa from "../enum/DificuldadeTarefa";

/** Teto semanal (horas) de quem não tem cargo. */
export const TETO_SEM_CARGO = 10;

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

/** Horas da tarefa que caem na semana que começa em `segunda`. */
export function horasNaSemana(t: TarefaParaOcupacao, horasDoNivel: number, segundaInformada: Date, hojeInformado: Date): number {
    if (t.concluida || !t.projetoAtivo || t.dificuldade === null) return 0;
    const hoje = noDia(hojeInformado);
    const segunda = segundaDaSemana(segundaInformada);
    const dataInicio = noDia(t.dataInicio);
    const dataFim = noDia(t.dataFim);
    const semanaDeHoje = segundaDaSemana(hoje).getTime();
    if (dataFim.getTime() < hoje.getTime()) {
        return segunda.getTime() === semanaDeHoje ? horasDoNivel : 0;
    }
    const dias: number[] = [];
    for (let ms = dataInicio.getTime(); ms <= dataFim.getTime(); ms += DIA) {
        const diaSemana = new Date(ms).getUTCDay();
        if (diaSemana >= 1 && diaSemana <= 5) dias.push(ms);
    }
    if (dias.length === 0) {
        const diaInicio = dataInicio.getUTCDay();
        const sexta = dataInicio.getTime() - (diaInicio === 0 ? 2 : diaInicio === 6 ? 1 : 0) * DIA;
        return segundaDaSemana(new Date(sexta)).getTime() === segunda.getTime() ? horasDoNivel : 0;
    }
    const inicio = segunda.getTime();
    const fim = inicio + 4 * DIA;
    const dentro = dias.filter((ms) => ms >= inicio && ms <= fim).length;
    return (horasDoNivel * dentro) / dias.length;
}

const arredondar = (n: number) => Math.round(n * 10) / 10;

export function calcularOcupacao(
    tarefas: TarefaParaOcupacao[],
    horas: Record<DificuldadeTarefa, number>,
    tetos: Map<string, number>,
    codigosUsuarios: string[],
    segunda: Date,
    hoje: Date,
): OcupacaoPessoa[] {
    const porPessoa = new Map<string, Array<{ codigo: string; horas: number }>>();
    for (const c of codigosUsuarios) porPessoa.set(c, []);
    for (const t of tarefas) {
        if (t.dificuldade === null) continue;
        const h = horasNaSemana(t, horas[t.dificuldade], segunda, hoje);
        if (h <= 0) continue;
        for (const r of t.responsaveis) porPessoa.get(r)?.push({ codigo: t.codigo, horas: h });
    }
    return codigosUsuarios.map((codigoUsuario) => {
        const itens = porPessoa.get(codigoUsuario) ?? [];
        const soma = itens.reduce((s, i) => s + i.horas, 0);
        const teto = tetos.get(codigoUsuario) ?? TETO_SEM_CARGO;
        return {
            codigoUsuario,
            horas: arredondar(soma),
            teto,
            percentual: Math.round((soma / teto) * 100),
            tarefas: itens.map((i) => ({ codigo: i.codigo, horas: arredondar(i.horas) })),
        };
    });
}
