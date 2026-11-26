import Projeto from "../source/domain/entity/Projeto";
import CriarProjeto from "../source/useCases/projetos/CriarProjeto";
import EditarProjeto from "../source/useCases/projetos/EditarProjeto";
import { criarContexto, dataInicio, dataFim, obrigatoriosDoProjeto } from "./fixtures";

test("cria um projeto com membros válidos", async () => {
    const { factory, membro } = await criarContexto();

    const projeto = await new CriarProjeto(factory).execute({
        ...(await obrigatoriosDoProjeto(factory)),
        nome: " Projeto Novo ",
        descricao: " Descrição do projeto ",
        dataInicio,
        dataFim,
        codigosMembros: [membro.codigo],
    });

    expect(projeto.nome).toBe("Projeto Novo");
    expect(projeto.membros).toHaveLength(1);
});

describe("criador do projeto (histórico; não dá acesso desde a 27a; sem sigilo desde a 31a)", () => {
    const novo = (detalhes?: ConstructorParameters<typeof Projeto>[7]) =>
        new Projeto("P", "Descrição", dataInicio, dataFim, undefined, [], undefined, detalhes);

    test("guarda o criador; sem detalhes, sem criador", () => {
        expect(novo({ criadoPor: "u1" }).criadoPor).toBe("u1");
        expect(novo().criadoPor).toBeNull();
    });

    test("copiar mantém o criador; toJSON sem criador, sem sigilo e sem lista de acesso", () => {
        const copia = novo({ criadoPor: "u1" }).copiar({});
        expect(copia.criadoPor).toBe("u1");
        const json = copia.toJSON() as any;
        expect(json).not.toHaveProperty("sigiloso");
        expect(json).not.toHaveProperty("criadoPor");
        expect(json).not.toHaveProperty("acesso");
    });

    test("CriarProjeto repassa o criador", async () => {
        const { factory, membro } = await criarContexto();
        const projeto = await new CriarProjeto(factory).execute({
            ...(await obrigatoriosDoProjeto(factory)),
            nome: "Novo",
            descricao: "Descrição",
            dataInicio,
            dataFim,
            criadoPor: membro.codigo,
        });
        expect(projeto.criadoPor).toBe(membro.codigo);
    });
});

describe("classe e área obrigatórias (sessão 31b)", () => {
    const base = { nome: "Novo", descricao: "Descrição", dataInicio, dataFim };

    test("criar sem classe: 400 CLASSE_OBRIGATORIA; classe inexistente: 400 CLASSE_NAO_ENCONTRADA", async () => {
        const { factory } = await criarContexto();
        const { codigoArea } = await obrigatoriosDoProjeto(factory);
        await expect(new CriarProjeto(factory).execute({ ...base, codigoArea })).rejects.toMatchObject({ codigo: "CLASSE_OBRIGATORIA" });
        await expect(new CriarProjeto(factory).execute({ ...base, codigoArea, codigoClasse: "nada" })).rejects.toMatchObject({
            codigo: "CLASSE_NAO_ENCONTRADA",
        });
    });

    test("projeto de cliente sem área: 400 AREA_OBRIGATORIA_CLIENTE", async () => {
        const { factory } = await criarContexto();
        await expect(new CriarProjeto(factory).execute({ ...base, codigoClasse: "crm" })).rejects.toMatchObject({
            codigo: "AREA_OBRIGATORIA_CLIENTE",
        });
    });

    test("projeto antigo sem classe nem área segue editável; tirar a classe dá 400", async () => {
        const { factory, membro } = await criarContexto();
        const antigo = await factory
            .criarProjetoRepository()
            .criar(new Projeto("Antigo", "d", dataInicio, dataFim, undefined, [membro], "p-antigo"));
        const editar = (extra: object) =>
            new EditarProjeto(factory).execute({ codigo: antigo.codigo, nome: "Antigo 2", descricao: "d", dataInicio, dataFim, ...extra });
        expect((await editar({})).nome).toBe("Antigo 2");
        const comClasse = await editar({ codigoClasse: "saas" });
        expect(comClasse.classe?.nome).toBe("SaaS");
        await expect(editar({ codigoClasse: null })).rejects.toMatchObject({ codigo: "CLASSE_OBRIGATORIA" });
    });

    test("clientes: lista validada, nome obrigatório, telefone e e-mail conferidos", async () => {
        const { factory } = await criarContexto();
        const ok = await new CriarProjeto(factory).execute({
            ...base,
            ...(await obrigatoriosDoProjeto(factory)),
            clientes: [{ nome: " Ana ", empresa: "Padaria Sol", telefone: "(34) 99999-1111", email: "ana@sol.com" }, { nome: "Bruno" }],
        });
        expect(ok.clientes).toEqual([
            { nome: "Ana", empresa: "Padaria Sol", telefone: "(34) 99999-1111", email: "ana@sol.com" },
            { nome: "Bruno", empresa: null, telefone: null, email: null },
        ]);
        expect(ok.toJSON().clientes).toEqual([
            { nome: "Ana", empresa: "Padaria Sol" },
            { nome: "Bruno", empresa: null },
        ]);
        const criar = (clientes: unknown) =>
            obrigatoriosDoProjeto(factory).then((o) => new CriarProjeto(factory).execute({ ...base, ...o, clientes }));
        await expect(criar([{ empresa: "X" }])).rejects.toMatchObject({ codigo: "CLIENTE_SEM_NOME" });
        await expect(criar([{ nome: "A", telefone: "123" }])).rejects.toMatchObject({ codigo: "CLIENTE_TELEFONE_INVALIDO" });
        await expect(criar([{ nome: "A", email: "x@" }])).rejects.toMatchObject({ codigo: "CLIENTE_EMAIL_INVALIDO" });
        await expect(criar("texto")).rejects.toMatchObject({ codigo: "CLIENTES_INVALIDOS" });
    });
});
