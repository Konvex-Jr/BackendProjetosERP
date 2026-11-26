import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import SalvarHorasDificuldade from "../source/useCases/config/SalvarHorasDificuldade";
import SalvarCargo from "../source/useCases/config/SalvarCargo";
import { criarContexto } from "./fixtures";

const PADRAO = { rapida: 25, facil: 50, media: 75, dificil: 100 };

test("sem gravar, devolve os percentuais padrão", async () => {
    const { factory } = await criarContexto();
    expect(await factory.criarHorasDificuldadeRepository().listar()).toEqual(PADRAO);
});

test("diretor grava os percentuais e o repositório devolve", async () => {
    const { factory } = await criarContexto();
    const novas = { rapida: 5, facil: 30, media: 60, dificil: 100 };
    const salvas = await new SalvarHorasDificuldade(factory).execute({
        horas: novas,
        quem: { codigo: "d", perfil: PerfilUsuario.DIRETOR },
    });
    expect(salvas).toEqual(novas);
    expect(await factory.criarHorasDificuldadeRepository().listar()).toEqual(novas);
});

test("percentual fora de 5 a 100, não inteiro ou nível faltando: 400 HORAS_DIFICULDADE_INVALIDAS", async () => {
    const { factory } = await criarContexto();
    const quem = { codigo: "d", perfil: PerfilUsuario.DIRETOR };
    const salvar = (horas: unknown) => new SalvarHorasDificuldade(factory).execute({ horas: horas as never, quem });
    await expect(salvar({ ...PADRAO, media: 4 })).rejects.toMatchObject({ codigo: "HORAS_DIFICULDADE_INVALIDAS" });
    await expect(salvar({ ...PADRAO, media: 101 })).rejects.toMatchObject({ codigo: "HORAS_DIFICULDADE_INVALIDAS" });
    await expect(salvar({ ...PADRAO, media: 50.5 })).rejects.toMatchObject({ codigo: "HORAS_DIFICULDADE_INVALIDAS" });
    await expect(salvar({ ...PADRAO, media: "75" })).rejects.toMatchObject({ codigo: "HORAS_DIFICULDADE_INVALIDAS" });
    await expect(salvar({ rapida: 25, facil: 50, media: 75 })).rejects.toMatchObject({ codigo: "HORAS_DIFICULDADE_INVALIDAS" });
});

test("membro não grava os percentuais: 403", async () => {
    const { factory, membro } = await criarContexto();
    await expect(new SalvarHorasDificuldade(factory).execute({ horas: PADRAO, quem: membro })).rejects.toMatchObject({
        message: expect.stringContaining("diretores"),
    });
});

describe("teto semanal do cargo", () => {
    test("padrão 10; grava e mantém quando o campo não vem", async () => {
        const { factory } = await criarContexto();
        const criado = await new SalvarCargo(factory).execute({ nome: "Analista" });
        expect(criado.tetoSemanalHoras).toBe(10);
        const alto = await new SalvarCargo(factory).execute({ codigo: criado.codigo, nome: "Analista", tetoSemanalHoras: 20 });
        expect(alto.tetoSemanalHoras).toBe(20);
        const mesmo = await new SalvarCargo(factory).execute({ codigo: criado.codigo, nome: "Analista" });
        expect(mesmo.tetoSemanalHoras).toBe(20);
    });

    test.each([0, 41, 1.5])("teto %p: 400 TETO_INVALIDO", async (teto) => {
        const { factory } = await criarContexto();
        await expect(new SalvarCargo(factory).execute({ nome: "Analista", tetoSemanalHoras: teto })).rejects.toMatchObject({
            codigo: "TETO_INVALIDO",
        });
    });
});
