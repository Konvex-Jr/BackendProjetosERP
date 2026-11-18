import Area from "../source/domain/entity/Area";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import ListarUsuarios from "../source/useCases/pessoas/ListarUsuarios";
import { criarContexto } from "./fixtures";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

test("lista os usuários cadastrados", async () => {
    const { factory } = await criarContexto();
    const usuarios = await new ListarUsuarios(factory).execute();

    expect(usuarios).toHaveLength(2);
});

test("filtro por área acha a pessoa pela área atual, e não pela encerrada", async () => {
    const { factory, membro } = await criarContexto();
    const antiga = new Area("Marketing");
    const atual = new Area("Projetos");
    const periodos = factory.criarPeriodoAreaRepository();
    await periodos.criar(new PeriodoArea(membro.codigo, antiga, null, dia("2025-01-01"), dia("2026-01-01"), null));
    await periodos.criar(new PeriodoArea(membro.codigo, atual, null, dia("2026-01-01"), null, null));

    const listar = new ListarUsuarios(factory);
    expect((await listar.execute({ codigoArea: atual.codigo })).map((u) => u.codigo)).toEqual([membro.codigo]);
    expect(await listar.execute({ codigoArea: antiga.codigo })).toEqual([]);
    const todos = await listar.execute();
    expect(todos.find((u) => u.codigo === membro.codigo)!.areas.map((a) => a.area.nome)).toEqual(["Projetos"]);
});
