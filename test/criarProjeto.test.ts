import Projeto from "../source/domain/entity/Projeto";
import CriarProjeto from "../source/useCases/projetos/CriarProjeto";
import { criarContexto, dataInicio, dataFim } from "./fixtures";

test("cria um projeto com membros válidos", async () => {
    const { factory, membro } = await criarContexto();

    const projeto = await new CriarProjeto(factory).execute({
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
            nome: "Novo",
            descricao: "Descrição",
            dataInicio,
            dataFim,
            criadoPor: membro.codigo,
        });
        expect(projeto.criadoPor).toBe(membro.codigo);
    });
});
