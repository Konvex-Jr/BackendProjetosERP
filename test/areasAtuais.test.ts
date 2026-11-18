import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import Usuario from "../source/domain/entity/Usuario";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import { preencherAreasAtuais } from "../source/useCases/pessoas/areasAtuais";
import { criarContexto } from "./fixtures";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("preencherAreasAtuais", () => {
    test("preenche duas pessoas com uma consulta só, apenas com os períodos abertos", async () => {
        const { factory, membro, gerente } = await criarContexto();
        const projetos = new Area("Projetos");
        const marketing = new Area("Marketing");
        const gerenteCargo = new Cargo("Gerente", true, undefined, true);
        const periodos = factory.criarPeriodoAreaRepository();
        await periodos.criar(new PeriodoArea(membro.codigo, projetos, gerenteCargo, dia("2026-02-01"), null, null));
        await periodos.criar(new PeriodoArea(membro.codigo, marketing, null, dia("2025-02-01"), dia("2026-01-01"), null));
        await periodos.criar(new PeriodoArea(gerente.codigo, marketing, null, dia("2026-03-01"), null, null));

        const espiao = jest.spyOn(periodos, "listarAbertosDe");
        const [m, g] = await preencherAreasAtuais(factory, [membro, gerente]);

        expect(espiao).toHaveBeenCalledTimes(1);
        expect(m.areas.map((a) => [a.area.nome, a.cargo?.nome ?? null, a.inicio])).toEqual([["Projetos", "Gerente", dia("2026-02-01")]]);
        expect(m.areas[0].cargo?.lideraArea).toBe(true);
        expect(g.areas.map((a) => a.area.nome)).toEqual(["Marketing"]);
        expect(g.areas[0].codigoPeriodo).toBeTruthy();
        expect(m.toJSON().areas).toHaveLength(1);
    });

    test("pessoa fora da EJ com período aberto (dado incoerente) fica sem áreas atuais", async () => {
        const { factory, senioridade } = await criarContexto();
        const alumni = new Usuario("Beto", "beto@konvex.com.br", PerfilUsuario.MEMBRO, false, "hash", senioridade, "usr-beto", {
            status: StatusPessoa.ALUMNI,
        });
        await factory.criarUsuarioRepository().criar(alumni);
        await factory
            .criarPeriodoAreaRepository()
            .criar(new PeriodoArea(alumni.codigo, new Area("Projetos"), null, dia("2026-01-01"), null, null));

        const [preenchido] = await preencherAreasAtuais(factory, [alumni]);
        expect(preenchido.areas).toEqual([]);
    });

    test("pessoa nova nasce sem áreas", async () => {
        const { membro } = await criarContexto();
        expect(membro.areas).toEqual([]);
        expect(membro.toJSON()).not.toHaveProperty("area");
        expect(membro.toJSON()).not.toHaveProperty("cargo");
    });
});
