import DificuldadeTarefa, { PERCENTUAL_PADRAO } from "../source/domain/enum/DificuldadeTarefa";
import { TETO_SEM_CARGO } from "../source/domain/entity/Cargo";
import { TarefaParaOcupacao, calcularOcupacao, diasNaSemana, segundaDaSemana } from "../source/domain/service/ocupacao";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

function tarefa(p: Partial<TarefaParaOcupacao> = {}): TarefaParaOcupacao {
    return {
        codigo: "T1",
        dataInicio: d("2026-11-23"),
        dataFim: d("2026-11-23"),
        concluida: false,
        projetoAtivo: true,
        dificuldade: DificuldadeTarefa.MEDIA,
        responsaveis: ["U1"],
        ...p,
    };
}

describe("segundaDaSemana", () => {
    it("domingo volta para a segunda anterior", () => {
        expect(segundaDaSemana(d("2026-11-29")).toISOString()).toBe(d("2026-11-23").toISOString());
    });
    it("segunda fica igual", () => {
        expect(segundaDaSemana(d("2026-11-23")).toISOString()).toBe(d("2026-11-23").toISOString());
    });
});

describe("diasNaSemana", () => {
    const hoje = d("2026-11-23");
    const duasSemanas = tarefa({ dificuldade: DificuldadeTarefa.DIFICIL, dataInicio: d("2026-11-23"), dataFim: d("2026-12-04") });

    it("conta os dias úteis do prazo dentro da semana", () => {
        expect(diasNaSemana(duasSemanas, d("2026-11-23"), hoje)).toBe(5);
        expect(diasNaSemana(duasSemanas, d("2026-11-30"), hoje)).toBe(5);
        expect(diasNaSemana(duasSemanas, d("2026-12-07"), hoje)).toBe(0);
    });

    it("prazo só de fim de semana conta 1 dia na semana da sexta anterior", () => {
        const t = tarefa({ dataInicio: d("2026-11-28"), dataFim: d("2026-11-29") });
        expect(diasNaSemana(t, d("2026-11-23"), hoje)).toBe(1);
        expect(diasNaSemana(t, d("2026-11-30"), hoje)).toBe(0);
    });

    it("atrasada conta os dias úteis que restam na semana de hoje", () => {
        const t = tarefa({ dataInicio: d("2026-11-16"), dataFim: d("2026-11-20") });
        expect(diasNaSemana(t, d("2026-11-23"), d("2026-11-23"))).toBe(5);
        expect(diasNaSemana(t, d("2026-11-23"), d("2026-11-26"))).toBe(2);
        expect(diasNaSemana(t, d("2026-11-23"), d("2026-11-28"))).toBe(1);
        expect(diasNaSemana(t, d("2026-11-16"), hoje)).toBe(0);
    });

    it("hora do dia nas datas (meio-dia local = 15:00Z) não tira dia da conta", () => {
        const comHora = (s: string) => new Date(`${s}T15:00:00.000Z`);
        const t = tarefa({ dificuldade: DificuldadeTarefa.DIFICIL, dataInicio: comHora("2026-11-23"), dataFim: comHora("2026-11-27") });
        expect(diasNaSemana(t, d("2026-11-23"), hoje)).toBe(5);
        expect(diasNaSemana(t, comHora("2026-11-23"), comHora("2026-11-23"))).toBe(5);
        const [o] = calcularOcupacao([t], PERCENTUAL_PADRAO, new Map(), ["U1"], comHora("2026-11-25"), hoje);
        expect(o.horas).toBe(10);
    });

    it("concluída, sem dificuldade ou projeto inativo valem 0", () => {
        const t = tarefa({ dataInicio: d("2026-11-16"), dataFim: d("2026-11-20") });
        expect(diasNaSemana({ ...t, concluida: true }, d("2026-11-23"), hoje)).toBe(0);
        expect(diasNaSemana({ ...t, dificuldade: null }, d("2026-11-23"), hoje)).toBe(0);
        expect(diasNaSemana({ ...t, projetoAtivo: false }, d("2026-11-23"), hoje)).toBe(0);
    });

    it("dataInicio depois de dataFim não lança", () => {
        const t = tarefa({ dataInicio: d("2026-11-25"), dataFim: d("2026-11-23") });
        expect(() => diasNaSemana(t, hoje, hoje)).not.toThrow();
    });
});

describe("calcularOcupacao (dificuldade = % do dia, dia = teto ÷ 5)", () => {
    const hoje = d("2026-11-23");
    const segunda = d("2026-11-23");

    it("Difícil de duas semanas enche as duas semanas (10 h de 10 h)", () => {
        const t = tarefa({ dificuldade: DificuldadeTarefa.DIFICIL, dataInicio: d("2026-11-23"), dataFim: d("2026-12-04") });
        for (const s of ["2026-11-23", "2026-11-30"]) {
            const [r] = calcularOcupacao([t], PERCENTUAL_PADRAO, new Map(), ["U1"], d(s), hoje);
            expect(r).toMatchObject({ horas: 10, percentual: 100 });
        }
    });

    it("Média de um dia = 1,5 h; Fácil = 1 h; Rápida = 0,5 h", () => {
        const um = (dificuldade: DificuldadeTarefa) =>
            calcularOcupacao([tarefa({ dificuldade })], PERCENTUAL_PADRAO, new Map(), ["U1"], segunda, hoje)[0];
        expect(um(DificuldadeTarefa.MEDIA)).toMatchObject({ horas: 1.5, percentual: 15 });
        expect(um(DificuldadeTarefa.FACIL)).toMatchObject({ horas: 1, percentual: 10 });
        expect(um(DificuldadeTarefa.RAPIDA)).toMatchObject({ horas: 0.5, percentual: 5 });
    });

    it("teto de 20 h dobra as horas do dia, mas a % é a mesma", () => {
        const t = tarefa({ dificuldade: DificuldadeTarefa.DIFICIL, dataFim: d("2026-11-27") });
        const r = calcularOcupacao(
            [tarefa({ ...t, responsaveis: ["U1", "D1"] })],
            PERCENTUAL_PADRAO,
            new Map([["D1", 20]]),
            ["U1", "D1"],
            segunda,
            hoje,
        );
        expect(r.map((x) => [x.horas, x.percentual])).toEqual([
            [10, 100],
            [20, 100],
        ]);
    });

    it("duas Difíceis no mesmo período passam de 100%", () => {
        const a = tarefa({ dificuldade: DificuldadeTarefa.DIFICIL, dataFim: d("2026-11-27") });
        const [r] = calcularOcupacao([a, { ...a, codigo: "T2" }], PERCENTUAL_PADRAO, new Map(), ["U1"], segunda, hoje);
        expect(r.percentual).toBe(200);
    });

    it("usa a % configurada", () => {
        const [r] = calcularOcupacao([tarefa()], { ...PERCENTUAL_PADRAO, media: 40 }, new Map(), ["U1"], segunda, hoje);
        expect(r.horas).toBe(0.8);
    });

    it("arredonda a 1 casa", () => {
        const t = (codigo: string) => tarefa({ codigo, dificuldade: DificuldadeTarefa.RAPIDA, dataFim: d("2026-11-25") });
        const [r] = calcularOcupacao([t("A"), t("B"), t("C")], { ...PERCENTUAL_PADRAO, rapida: 33 }, new Map(), ["U1"], segunda, hoje);
        expect(r.tarefas.map((x) => x.horas)).toEqual([2, 2, 2]);
        expect(r.horas).toBe(5.9);
        expect(r.percentual).toBe(59);
    });

    it("pessoa sem tarefas aparece com 0 e teto padrão", () => {
        const [r] = calcularOcupacao([], PERCENTUAL_PADRAO, new Map(), ["U9"], segunda, hoje);
        expect(r).toEqual({ codigoUsuario: "U9", horas: 0, teto: TETO_SEM_CARGO, percentual: 0, tarefas: [] });
    });

    it("ignora responsável fora da lista", () => {
        const r = calcularOcupacao([tarefa({ responsaveis: ["X"] })], PERCENTUAL_PADRAO, new Map(), ["U1"], segunda, hoje);
        expect(r[0].horas).toBe(0);
    });
});
