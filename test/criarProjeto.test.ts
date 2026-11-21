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

describe("sigilo do projeto (sessão 20; sem lista de acesso desde a 27a)", () => {
    const novo = (detalhes?: ConstructorParameters<typeof Projeto>[7]) =>
        new Projeto("P", "Descrição", dataInicio, dataFim, undefined, [], undefined, detalhes);

    test("guarda sigilo e criador", () => {
        const projeto = novo({ sigiloso: true, criadoPor: "u1" });
        expect(projeto.sigiloso).toBe(true);
        expect(projeto.criadoPor).toBe("u1");
    });

    test("sem detalhes o projeto é aberto e sem criador", () => {
        const projeto = novo();
        expect(projeto.sigiloso).toBe(false);
        expect(projeto.criadoPor).toBeNull();
    });

    test("copiar mantém o que não mudou; toJSON mostra o sigilo, sem criador nem lista de acesso", () => {
        const copia = novo({ sigiloso: true, criadoPor: "u1" }).copiar({ sigiloso: false });
        expect(copia.sigiloso).toBe(false);
        expect(copia.criadoPor).toBe("u1");
        const json = copia.toJSON() as any;
        expect(json.sigiloso).toBe(false);
        expect(json).not.toHaveProperty("criadoPor");
        expect(json).not.toHaveProperty("acesso");
    });

    test("CriarProjeto repassa criador e sigilo", async () => {
        const { factory, membro } = await criarContexto();
        const projeto = await new CriarProjeto(factory).execute({
            nome: "Secreto",
            descricao: "Descrição",
            dataInicio,
            dataFim,
            criadoPor: membro.codigo,
            sigiloso: true,
        });
        expect(projeto.sigiloso).toBe(true);
        expect(projeto.criadoPor).toBe(membro.codigo);
    });
});
