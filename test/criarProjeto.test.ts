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

describe("sigilo e acesso do projeto (sessão 20)", () => {
    const novo = (detalhes?: ConstructorParameters<typeof Projeto>[7]) =>
        new Projeto("P", "Descrição", dataInicio, dataFim, undefined, [], undefined, detalhes);

    test("guarda sigilo, criador e acesso sem repetição", () => {
        const projeto = novo({ sigiloso: true, criadoPor: "u1", acesso: ["a", "a", "b"] });
        expect(projeto.sigiloso).toBe(true);
        expect(projeto.criadoPor).toBe("u1");
        expect(projeto.acesso).toEqual(["a", "b"]);
    });

    test("sem detalhes o projeto é aberto e sem lista de acesso", () => {
        const projeto = novo();
        expect(projeto.sigiloso).toBe(false);
        expect(projeto.acesso).toEqual([]);
        expect(projeto.criadoPor).toBeNull();
    });

    test("copiar mantém o que não mudou; toJSON mostra sigilo e acesso, não o criador", () => {
        const copia = novo({ sigiloso: true, criadoPor: "u1", acesso: ["a"] }).copiar({ sigiloso: false });
        expect(copia.sigiloso).toBe(false);
        expect(copia.acesso).toEqual(["a"]);
        expect(copia.criadoPor).toBe("u1");
        const json = copia.toJSON() as any;
        expect(json.acesso).toEqual(["a"]);
        expect(json.sigiloso).toBe(false);
        expect(json).not.toHaveProperty("criadoPor");
    });

    test("CriarProjeto repassa criador, sigilo e acesso", async () => {
        const { factory, membro } = await criarContexto();
        const projeto = await new CriarProjeto(factory).execute({
            nome: "Secreto",
            descricao: "Descrição",
            dataInicio,
            dataFim,
            criadoPor: membro.codigo,
            sigiloso: true,
            acesso: [membro.codigo],
        });
        expect(projeto.sigiloso).toBe(true);
        expect(projeto.criadoPor).toBe(membro.codigo);
        expect(projeto.acesso).toEqual([membro.codigo]);
    });
});
