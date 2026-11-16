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
