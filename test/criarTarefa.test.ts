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
