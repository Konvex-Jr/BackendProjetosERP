import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import { areasLideradas, lideraArea, lideresDaArea } from "../source/shared/seguranca/liderancaArea";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const projetos = new Area("Projetos", null, true, "projetos");
const inovacao = new Area("Inovação", "projetos", true, "inovacao");
const pesquisa = new Area("Pesquisa", "inovacao", true, "pesquisa");
const marketing = new Area("Marketing", null, true, "marketing");
const areas = [projetos, inovacao, pesquisa, marketing];

const gerente = new Cargo("Gerente", true, "gerente", true);
const assessor = new Cargo("Assessor", true, "assessor", false);

const membro = { codigo: "usr-ana", perfil: PerfilUsuario.MEMBRO, status: StatusPessoa.ATIVO };
const aberto = (area: Area, cargo: Cargo | null, codigoUsuario = membro.codigo) =>
    new PeriodoArea(codigoUsuario, area, cargo, dia("2026-02-01"), null, null);

describe("liderança das áreas (regra provisória)", () => {
    test("diretor do sistema sem período lidera tudo", () => {
        const diretor = { codigo: "usr-dir", perfil: PerfilUsuario.DIRETOR, status: StatusPessoa.ATIVO };
        expect(lideraArea(diretor, "pesquisa", areas, [])).toBe(true);
        expect(areasLideradas(diretor, areas, [])).toEqual(new Set(["projetos", "inovacao", "pesquisa", "marketing"]));
    });

    test("gerente de Projetos lidera a filha (Inovação) e a neta (Pesquisa)", () => {
        const periodos = [aberto(projetos, gerente)];
        expect(lideraArea(membro, "projetos", areas, periodos)).toBe(true);
        expect(lideraArea(membro, "inovacao", areas, periodos)).toBe(true);
        expect(lideraArea(membro, "pesquisa", areas, periodos)).toBe(true);
        expect(lideraArea(membro, "marketing", areas, periodos)).toBe(false);
        expect(areasLideradas(membro, areas, periodos)).toEqual(new Set(["projetos", "inovacao", "pesquisa"]));
    });

    test("gerente de Inovação não lidera Projetos", () => {
        const periodos = [aberto(inovacao, gerente)];
        expect(lideraArea(membro, "projetos", areas, periodos)).toBe(false);
        expect(lideraArea(membro, "pesquisa", areas, periodos)).toBe(true);
        expect(areasLideradas(membro, areas, periodos)).toEqual(new Set(["inovacao", "pesquisa"]));
    });

    test("cargo que não lidera (Assessor) e período sem cargo não lideram", () => {
        const periodos = [aberto(projetos, assessor), aberto(marketing, null)];
        expect(lideraArea(membro, "projetos", areas, periodos)).toBe(false);
        expect(lideraArea(membro, "marketing", areas, periodos)).toBe(false);
        expect(areasLideradas(membro, areas, periodos).size).toBe(0);
    });

    test("período encerrado não lidera", () => {
        const encerrado = new PeriodoArea(membro.codigo, projetos, gerente, dia("2025-02-01"), dia("2026-01-01"), null);
        expect(lideraArea(membro, "projetos", areas, [encerrado])).toBe(false);
        expect(areasLideradas(membro, areas, [encerrado]).size).toBe(0);
    });

    test("período de outra pessoa não conta", () => {
        expect(lideraArea(membro, "projetos", areas, [aberto(projetos, gerente, "usr-outra")])).toBe(false);
    });

    test("pessoa fora da EJ não lidera, mesmo com período aberto", () => {
        const alumni = { ...membro, status: StatusPessoa.ALUMNI };
        expect(lideraArea(alumni, "projetos", areas, [aberto(projetos, gerente)])).toBe(false);
    });

    test("ciclo de áreas no dado não trava e devolve falso", () => {
        const a = new Area("A", "b", true, "a");
        const b = new Area("B", "a", true, "b");
        const ciclicas = [a, b, marketing];
        expect(lideraArea(membro, "a", ciclicas, [aberto(marketing, gerente)])).toBe(false);
        expect(areasLideradas(membro, ciclicas, [aberto(marketing, gerente)])).toEqual(new Set(["marketing"]));
    });
});

describe("lideresDaArea", () => {
    test("líder da área pai entra; cargo sem lideraArea e período encerrado não entram", () => {
        const periodos = [
            aberto(projetos, gerente, "chefe"),
            aberto(inovacao, assessor, "assessor"),
            new PeriodoArea("antigo", inovacao, gerente, dia("2026-01-01"), dia("2026-02-01"), null),
            aberto(marketing, gerente, "outra-area"),
        ];
        expect(lideresDaArea("inovacao", areas, periodos)).toEqual(["chefe"]);
    });

    test("sem repetição e sem travar em ciclo", () => {
        const a = new Area("A", "b", true, "a");
        const b = new Area("B", "a", true, "b");
        const periodos = [aberto(a, gerente, "x"), aberto(b, gerente, "x")];
        expect(lideresDaArea("a", [a, b], periodos)).toEqual(["x"]);
    });
});
