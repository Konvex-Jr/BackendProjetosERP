import Area from "../source/domain/entity/Area";
import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import Usuario from "../source/domain/entity/Usuario";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";
import TipoProjeto from "../source/domain/enum/TipoProjeto";
import { comPapel } from "./papel";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const senio = new SenioridadeUsuario("pleno", "Pleno", 75);
const pessoa = (codigo: string) => comPapel(new Usuario(codigo, `${codigo}@konvex.com.br`, true, "h", senio, codigo), "membro");
const inovacao = new Area("Inovação", null, true, "inovacao");
const novo = (d: object = {}, membros: Usuario[] = []) =>
    new Projeto("P", "Desc", dia("2026-01-01"), dia("2026-12-31"), undefined, membros, "p1", d);

describe("projeto interno e geral", () => {
    test("interno sem área lança AREA_OBRIGATORIA_INTERNO", () => {
        expect(() => novo({ tipo: TipoProjeto.INTERNO })).toThrow(expect.objectContaining({ codigo: "AREA_OBRIGATORIA_INTERNO" }));
    });

    test("geral sigiloso lança GERAL_SIGILOSO", () => {
        const d = { tipo: TipoProjeto.INTERNO, area: inovacao, geralDaArea: true, sigiloso: true };
        expect(() => novo(d)).toThrow(expect.objectContaining({ codigo: "GERAL_SIGILOSO" }));
    });

    test("geral de cliente lança GERAL_INTERNO", () => {
        expect(() => novo({ area: inovacao, geralDaArea: true })).toThrow(expect.objectContaining({ codigo: "GERAL_INTERNO" }));
    });

    test("padrão é cliente, sem geral e sem líderes da área", () => {
        const p = novo();
        expect([p.tipo, p.geralDaArea, p.lideresDaArea]).toEqual([TipoProjeto.CLIENTE, false, []]);
    });

    test("ehLider vale para o líder cadastrado e para os líderes da área", () => {
        const ana = pessoa("ana");
        const p = novo({ lider: ana, tipo: TipoProjeto.INTERNO, area: inovacao, lideresDaArea: ["chefe"] }, [ana, pessoa("bia")]);
        expect(p.ehLider("ana")).toBe(true);
        expect(p.ehLider("chefe")).toBe(true);
        expect(p.ehLider("bia")).toBe(false);
    });

    test("copiar mantém tipo, geralDaArea e lideresDaArea", () => {
        const p = novo({ tipo: TipoProjeto.INTERNO, area: inovacao, geralDaArea: true, lideresDaArea: ["chefe"] });
        const c = p.copiar({ nome: "Outro" });
        expect([c.tipo, c.geralDaArea, c.lideresDaArea]).toEqual([TipoProjeto.INTERNO, true, ["chefe"]]);
        expect(c.toJSON()).toMatchObject({ tipo: "interno", geralDaArea: true, lideresDaArea: ["chefe"] });
    });

    test("tarefa sem projeto lança PROJETO_OBRIGATORIO", () => {
        expect(() => new Tarefa(null as unknown as Projeto, "T", dia("2026-02-01"), dia("2026-02-02"))).toThrow(
            expect.objectContaining({ codigo: "PROJETO_OBRIGATORIO" }),
        );
    });
});
