import DificuldadeTarefa, { HORAS_PADRAO } from "../source/domain/enum/DificuldadeTarefa";
import { TarefaParaOcupacao, TETO_SEM_CARGO, calcularOcupacao, horasNaSemana, segundaDaSemana } from "../source/domain/service/ocupacao";

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

describe("horasNaSemana", () => {
    const hoje = d("2026-11-23");
    const dificil = tarefa({
        dificuldade: DificuldadeTarefa.DIFICIL,
        dataInicio: d("2026-11-23"),
        dataFim: d("2026-12-04"),
    });

    it("divide pelos dias úteis do intervalo", () => {
        expect(horasNaSemana(dificil, 8, d("2026-11-23"), hoje)).toBe(4);
        expect(horasNaSemana(dificil, 8, d("2026-11-30"), hoje)).toBe(4);
    });

    it("intervalo só de fim de semana conta na sexta anterior", () => {
        const t = tarefa({ dataInicio: d("2026-11-28"), dataFim: d("2026-11-29") });
        expect(horasNaSemana(t, 4, d("2026-11-23"), hoje)).toBe(4);
        expect(horasNaSemana(t, 4, d("2026-11-30"), hoje)).toBe(0);
    });

    it("atrasada cai inteira na semana de hoje", () => {
        const t = tarefa({ dataInicio: d("2026-11-16"), dataFim: d("2026-11-20") });
        expect(horasNaSemana(t, 2, d("2026-11-23"), hoje)).toBe(2);
        expect(horasNaSemana(t, 2, d("2026-11-16"), hoje)).toBe(0);
    });

    it("concluída, sem dificuldade ou projeto inativo valem 0", () => {
        const t = tarefa({ dataInicio: d("2026-11-16"), dataFim: d("2026-11-20") });
        expect(horasNaSemana({ ...t, concluida: true }, 2, d("2026-11-23"), hoje)).toBe(0);
        expect(horasNaSemana({ ...t, dificuldade: null }, 2, d("2026-11-23"), hoje)).toBe(0);
        expect(horasNaSemana({ ...t, projetoAtivo: false }, 2, d("2026-11-23"), hoje)).toBe(0);
    });
});

describe("calcularOcupacao", () => {
    const hoje = d("2026-11-23");
    const segunda = d("2026-11-23");

    it("dois responsáveis recebem as horas cheias cada um", () => {
        const r = calcularOcupacao([tarefa({ responsaveis: ["U1", "U2"] })], HORAS_PADRAO, new Map(), ["U1", "U2"], segunda, hoje);
        expect(r.map((x) => x.horas)).toEqual([4, 4]);
        expect(r[0].tarefas).toEqual([{ codigo: "T1", horas: 4 }]);
    });

    it("arredonda a 1 casa sem 0.9999", () => {
        const t = tarefa({
            dificuldade: DificuldadeTarefa.RAPIDA,
            dataInicio: d("2026-11-23"),
            dataFim: d("2026-11-25"),
        });
        const [r] = calcularOcupacao([t], HORAS_PADRAO, new Map(), ["U1"], segunda, hoje);
        expect(r.horas).toBe(1);
    });

    it("percentual usa o teto da pessoa", () => {
        const t = tarefa({ dificuldade: DificuldadeTarefa.DIFICIL });
        const t2 = tarefa({ codigo: "T2", dificuldade: DificuldadeTarefa.MEDIA });
        const [r] = calcularOcupacao([t, t2], HORAS_PADRAO, new Map([["U1", 10]]), ["U1"], segunda, hoje);
        expect(r.horas).toBe(12);
        expect(r.percentual).toBe(120);
    });

    it("pessoa sem tarefas aparece com 0 e teto padrão", () => {
        const [r] = calcularOcupacao([], HORAS_PADRAO, new Map(), ["U9"], segunda, hoje);
        expect(r).toEqual({ codigoUsuario: "U9", horas: 0, teto: TETO_SEM_CARGO, percentual: 0, tarefas: [] });
    });

    it("ignora responsável fora da lista", () => {
        const r = calcularOcupacao([tarefa({ responsaveis: ["X"] })], HORAS_PADRAO, new Map(), ["U1"], segunda, hoje);
        expect(r[0].horas).toBe(0);
    });
});
