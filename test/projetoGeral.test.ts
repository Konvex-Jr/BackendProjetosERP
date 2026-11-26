import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";
import Usuario from "../source/domain/entity/Usuario";
import { comEquipeDaArea, nomeDoGeral, novoGeral } from "../source/domain/entity/ProjetoGeral";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import StatusProjeto from "../source/domain/enum/StatusProjeto";
import TipoProjeto from "../source/domain/enum/TipoProjeto";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const senio = new SenioridadeUsuario("pleno", "Pleno", 75);
const pessoa = (codigo: string) => new Usuario(codigo, `${codigo}@konvex.com.br`, PerfilUsuario.MEMBRO, true, "h", senio, codigo);
const inovacao = new Area("Inovação", null, true, "inovacao");
const marketing = new Area("Marketing", null, true, "marketing");
const usuarios = new Map(["ana", "bia", "cris"].map((c) => [c, pessoa(c)]));
const cargo = new Cargo("Assessor", true, "assessor", false);

describe("projeto geral da área", () => {
    test("novoGeral monta o projeto fixo da área", () => {
        const g = novoGeral(inovacao, dia("2026-11-19"));
        expect(nomeDoGeral(inovacao)).toBe("Inovação geral");
        expect(g.nome).toBe("Inovação geral");
        expect(g.tipo).toBe(TipoProjeto.INTERNO);
        expect(g.geralDaArea).toBe(true);
        expect(g.status).toBe(StatusProjeto.EM_EXECUCAO);
        expect(g.dataFim).toEqual(dia("2099-12-31"));
        expect(g.colunas).toHaveLength(4);
    });

    test("área tem projeto geral por padrão; temGeral false desliga", () => {
        expect(inovacao.temGeral).toBe(true);
        expect(new Area("Presidência Executiva", null, true, undefined, false).temGeral).toBe(false);
    });

    test("área inativa gera geral arquivado", () => {
        const g = novoGeral(new Area("Velha", null, false, "velha"), dia("2026-11-19"));
        expect(g.status).toBe(StatusProjeto.ARQUIVADO);
    });

    test("comEquipeDaArea: só período aberto entra (25/11); encerrado e outra área ficam fora", () => {
        const g = novoGeral(inovacao, dia("2026-11-19"));
        const periodos = [
            new PeriodoArea("ana", inovacao, cargo, dia("2026-02-01"), null, null),
            new PeriodoArea("bia", inovacao, null, dia("2026-01-01"), dia("2026-03-01"), null),
            new PeriodoArea("cris", marketing, null, dia("2026-01-01"), null, null),
        ];
        const p = comEquipeDaArea(g, periodos, usuarios, ["ana"]);
        expect(p.membros.map((m) => m.codigo)).toEqual(["ana"]);
        expect(p.participacoes.some((x) => x.usuario.codigo === "bia")).toBe(false);
        expect(p.participacoes.some((x) => x.usuario.codigo === "cris")).toBe(false);
        expect(p.lideresDaArea).toEqual(["ana"]);
    });

    test("pessoa com período encerrado e outro aberto aparece uma vez", () => {
        const g = novoGeral(inovacao, dia("2026-11-19"));
        const periodos = [
            new PeriodoArea("ana", inovacao, null, dia("2026-01-01"), dia("2026-03-01"), null),
            new PeriodoArea("ana", inovacao, null, dia("2026-05-01"), null, null),
        ];
        const p = comEquipeDaArea(g, periodos, usuarios, []);
        expect(p.membros.map((m) => m.codigo)).toEqual(["ana"]);
        expect(p.participacoes).toHaveLength(1);
        expect(p.participacoes[0].ativa).toBe(true);
    });
});
