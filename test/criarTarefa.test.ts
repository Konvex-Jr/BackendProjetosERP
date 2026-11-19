import CriarTarefa from "../source/useCases/tarefas/CriarTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import { criarContexto, criarProjeto, dataInicio, dataFim } from "./fixtures";

test("cria uma tarefa vinculada a um projeto e responsável", async () => {
    const { factory, membro } = await criarContexto();
    const projeto = await criarProjeto(factory, membro);

    const tarefa = await new CriarTarefa(factory).execute({
        codigoProjeto: projeto.codigo,
        titulo: " Nova tarefa ",
        dataInicio,
        dataFim,
        prioridade: PrioridadeTarefa.P1,
        codigosResponsaveis: [membro.codigo],
    });

    expect(tarefa.titulo).toBe("Nova tarefa");
    expect(tarefa.responsaveis).toHaveLength(1);
});

test("não aceita responsável que não está na equipe do projeto", async () => {
    const { factory, membro, gerente } = await criarContexto();
    const projeto = await criarProjeto(factory, membro);

    await expect(
        new CriarTarefa(factory).execute({
            codigoProjeto: projeto.codigo,
            titulo: "Tarefa",
            dataInicio,
            dataFim,
            prioridade: PrioridadeTarefa.P1,
            codigosResponsaveis: [gerente.codigo],
        }),
    ).rejects.toMatchObject({ codigo: "RESPONSAVEL_FORA_DO_PROJETO" });
});

describe("coluna ao criar", () => {
    const criar = async (nomeColuna?: string) => {
        const { factory, membro } = await criarContexto();
        const projeto = await criarProjeto(factory, membro);
        const codigoColuna = nomeColuna ? projeto.colunas.find((c) => c.nome === nomeColuna)!.codigo : undefined;
        return new CriarTarefa(factory).execute({
            codigoProjeto: projeto.codigo,
            titulo: "Tarefa",
            dataInicio,
            dataFim,
            codigosResponsaveis: [membro.codigo],
            codigoColuna,
            criadaPor: membro,
        });
    };

    it("nasce na coluna de entrada", async () => {
        const t = await criar();
        expect(t.coluna!.nome).toBe("A fazer");
        expect(t.status).toBe("pendente");
    });

    it("nasce na coluna pedida", async () => {
        const t = await criar("Revisando");
        expect(t.coluna!.nome).toBe("Revisando");
        expect(t.status).toBe("andamento");
        expect(t.dataConclusao).toBeNull();
    });

    it("na concluída nasce com data e autor", async () => {
        const t = await criar("Concluído");
        expect(t.status).toBe("concluida");
        expect(t.dataConclusao).not.toBeNull();
        expect(t.concluidaPor?.codigo).toBe("usr-ana");
    });
});

describe("dificuldade", () => {
    const criar = async (dificuldade?: string | null) => {
        const { factory, membro } = await criarContexto();
        const projeto = await criarProjeto(factory, membro);
        return new CriarTarefa(factory).execute({
            codigoProjeto: projeto.codigo,
            titulo: "Tarefa",
            dataInicio,
            dataFim,
            prioridade: PrioridadeTarefa.P1,
            dificuldade,
        } as never);
    };

    it("grava e devolve a dificuldade", async () => {
        const t = await criar("media");
        expect(t.dificuldade).toBe("media");
        expect(JSON.parse(JSON.stringify(t)).dificuldade).toBe("media");
    });

    it("sem dificuldade fica nula", async () => {
        expect((await criar()).dificuldade).toBeNull();
    });

    it("dificuldade desconhecida: 400 DIFICULDADE_INVALIDA", async () => {
        await expect(criar("muito_dificil")).rejects.toMatchObject({ codigo: "DIFICULDADE_INVALIDA" });
    });
});
