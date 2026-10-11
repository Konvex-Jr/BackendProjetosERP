import CriarTarefa from "../source/useCases/CriarTarefa/CriarTarefa";
import PrioridadeTarefa from "../source/domain/Enum/PrioridadeTarefa";
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
