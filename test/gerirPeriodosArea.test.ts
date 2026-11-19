import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import { hoje } from "../source/shared/datas";
import AlterarStatusPessoa from "../source/useCases/pessoas/AlterarStatusPessoa";
import GerirPeriodosArea from "../source/useCases/pessoas/GerirPeriodosArea";
import { criarContexto } from "./fixtures";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function contexto() {
    const base = await criarContexto();
    const projetos = await base.factory.criarAreaRepository().criar(new Area("Projetos"));
    const marketing = await base.factory.criarAreaRepository().criar(new Area("Marketing"));
    const assessor = await base.factory.criarCargoRepository().criar(new Cargo("Assessor"));
    return { ...base, projetos, marketing, assessor, gerir: new GerirPeriodosArea(base.factory) };
}

describe("GerirPeriodosArea", () => {
    test("cria um período com cargo e registra quem lançou", async () => {
        const { gerir, membro, gerente, projetos, assessor } = await contexto();
        const periodo = await gerir.criar(
            membro.codigo,
            { codigoArea: projetos.codigo, codigoCargo: assessor.codigo, inicio: dia("2026-02-01") },
            gerente.codigo,
        );
        expect(periodo.area.nome).toBe("Projetos");
        expect(periodo.cargo?.nome).toBe("Assessor");
        expect(periodo.fim).toBeNull();
        expect(periodo.codigoRegistradoPor).toBe(gerente.codigo);
    });

    test("período sobreposto na mesma área: 400 PERIODO_SOBREPOSTO", async () => {
        const { gerir, membro, gerente, projetos } = await contexto();
        await gerir.criar(membro.codigo, { codigoArea: projetos.codigo, inicio: dia("2026-02-01") }, gerente.codigo);
        await expect(
            gerir.criar(membro.codigo, { codigoArea: projetos.codigo, inicio: dia("2026-01-01"), fim: dia("2026-03-01") }, gerente.codigo),
        ).rejects.toMatchObject({ codigo: "PERIODO_SOBREPOSTO" });
    });

    test("área ou cargo inexistente: 404; pessoa inexistente: 404", async () => {
        const { gerir, membro, gerente, projetos } = await contexto();
        await expect(
            gerir.criar(membro.codigo, { codigoArea: "nao-existe", inicio: dia("2026-02-01") }, gerente.codigo),
        ).rejects.toMatchObject({ codigoHttp: 404 });
        await expect(
            gerir.criar(
                membro.codigo,
                { codigoArea: projetos.codigo, codigoCargo: "nao-existe", inicio: dia("2026-02-01") },
                gerente.codigo,
            ),
        ).rejects.toMatchObject({ codigoHttp: 404 });
        await expect(
            gerir.criar("nao-existe", { codigoArea: projetos.codigo, inicio: dia("2026-02-01") }, gerente.codigo),
        ).rejects.toMatchObject({ codigoHttp: 404 });
    });

    test("período de outra pessoa no editar e no excluir: 404", async () => {
        const { gerir, membro, gerente, projetos } = await contexto();
        const doGerente = await gerir.criar(gerente.codigo, { codigoArea: projetos.codigo, inicio: dia("2026-02-01") }, gerente.codigo);
        await expect(
            gerir.editar(membro.codigo, doGerente.codigo, { codigoArea: projetos.codigo, inicio: dia("2026-01-01") }),
        ).rejects.toMatchObject({ codigoHttp: 404 });
        await expect(gerir.excluir(membro.codigo, doGerente.codigo)).rejects.toMatchObject({ codigoHttp: 404 });
        expect(await gerir.listar(gerente.codigo)).toHaveLength(1);
    });

    test("edita as datas sem acusar sobreposição consigo mesmo e exclui", async () => {
        const { gerir, membro, gerente, projetos } = await contexto();
        const periodo = await gerir.criar(membro.codigo, { codigoArea: projetos.codigo, inicio: dia("2026-02-01") }, gerente.codigo);
        const editado = await gerir.editar(membro.codigo, periodo.codigo, {
            codigoArea: projetos.codigo,
            inicio: dia("2026-01-15"),
            fim: dia("2026-06-01"),
        });
        expect(editado.inicio).toEqual(dia("2026-01-15"));
        expect(editado.fim).toEqual(dia("2026-06-01"));
        expect(editado.codigoRegistradoPor).toBe(gerente.codigo);

        await gerir.excluir(membro.codigo, periodo.codigo);
        expect(await gerir.listar(membro.codigo)).toEqual([]);
    });

    test("lista com os abertos primeiro, depois por início decrescente", async () => {
        const { gerir, membro, gerente, projetos, marketing } = await contexto();
        await gerir.criar(
            membro.codigo,
            { codigoArea: marketing.codigo, inicio: dia("2025-01-01"), fim: dia("2025-06-01") },
            gerente.codigo,
        );
        await gerir.criar(membro.codigo, { codigoArea: projetos.codigo, inicio: dia("2025-03-01") }, gerente.codigo);
        await gerir.criar(
            membro.codigo,
            { codigoArea: marketing.codigo, inicio: dia("2025-07-01"), fim: dia("2026-01-01") },
            gerente.codigo,
        );
        const lista = await gerir.listar(membro.codigo);
        expect(lista.map((p) => [p.area.nome, p.inicio])).toEqual([
            ["Projetos", dia("2025-03-01")],
            ["Marketing", dia("2025-07-01")],
            ["Marketing", dia("2025-01-01")],
        ]);
    });

    test("quem saiu e voltou a Ativo: períodos seguem fechados e um novo, depois da saída, é aceito", async () => {
        const { factory, gerir, membro, gerente, projetos } = await contexto();
        await gerir.criar(membro.codigo, { codigoArea: projetos.codigo, inicio: dia("2025-02-01") }, gerente.codigo);
        const status = new AlterarStatusPessoa(factory);
        await status.execute({ codigo: membro.codigo, status: StatusPessoa.ALUMNI, dataSaida: dia("2025-12-01") });

        // Fora da EJ, período em aberto é recusado.
        await expect(
            gerir.criar(membro.codigo, { codigoArea: projetos.codigo, inicio: dia("2026-01-01") }, gerente.codigo),
        ).rejects.toMatchObject({ codigo: "PESSOA_FORA_DA_EJ" });

        await status.execute({ codigo: membro.codigo, status: StatusPessoa.ATIVO });
        const [antigo] = await gerir.listar(membro.codigo);
        expect(antigo.fim).toEqual(dia("2025-12-01"));

        const novo = await gerir.criar(membro.codigo, { codigoArea: projetos.codigo, inicio: dia("2026-01-10") }, gerente.codigo);
        expect(novo.fim).toBeNull();
        expect((await gerir.listar(membro.codigo)).map((p) => p.codigo)).toEqual([novo.codigo, antigo.codigo]);
    });

    test("data no futuro: 400", async () => {
        const { gerir, membro, gerente, projetos } = await contexto();
        const amanha = new Date(hoje().getTime() + 86_400_000);
        await expect(gerir.criar(membro.codigo, { codigoArea: projetos.codigo, inicio: amanha }, gerente.codigo)).rejects.toMatchObject({
            codigo: "INICIO_NO_FUTURO",
        });
    });

    test("período encerrado de área desativada: corrige as datas, mas não reabre", async () => {
        const { factory, gerir, membro, gerente, projetos } = await contexto();
        const p = await gerir.criar(
            membro.codigo,
            { codigoArea: projetos.codigo, inicio: dia("2025-01-01"), fim: dia("2025-06-01") },
            gerente.codigo,
        );
        await factory.criarAreaRepository().editar(new Area(projetos.nome, null, false, projetos.codigo));
        const corrigido = await gerir.editar(membro.codigo, p.codigo, {
            codigoArea: projetos.codigo,
            inicio: dia("2025-02-01"),
            fim: dia("2025-06-01"),
        });
        expect(corrigido.inicio).toEqual(dia("2025-02-01"));
        await expect(
            gerir.editar(membro.codigo, p.codigo, { codigoArea: projetos.codigo, inicio: dia("2025-02-01"), fim: null }),
        ).rejects.toMatchObject({ codigo: "AREA_INATIVA_NAO_REABRE" });
    });

    test("saída da EJ com data no futuro: 400 SAIDA_NO_FUTURO", async () => {
        const { factory, membro } = await contexto();
        await expect(
            new AlterarStatusPessoa(factory).execute({
                codigo: membro.codigo,
                status: StatusPessoa.ALUMNI,
                dataSaida: new Date(hoje().getTime() + 86_400_000),
            }),
        ).rejects.toMatchObject({ codigo: "SAIDA_NO_FUTURO" });
    });

    test("dois cargos ao mesmo tempo em áreas diferentes: 400 PERIODO_CARGO_SIMULTANEO", async () => {
        const { gerir, membro, gerente, projetos, marketing, assessor } = await contexto();
        await gerir.criar(
            membro.codigo,
            { codigoArea: projetos.codigo, codigoCargo: assessor.codigo, inicio: dia("2026-02-01") },
            gerente.codigo,
        );
        await expect(
            gerir.criar(
                membro.codigo,
                { codigoArea: marketing.codigo, codigoCargo: assessor.codigo, inicio: dia("2026-03-01") },
                gerente.codigo,
            ),
        ).rejects.toMatchObject({ codigo: "PERIODO_CARGO_SIMULTANEO" });
        await expect(
            gerir.criar(membro.codigo, { codigoArea: marketing.codigo, inicio: dia("2026-03-01") }, gerente.codigo),
        ).resolves.toBeDefined();
    });
});
