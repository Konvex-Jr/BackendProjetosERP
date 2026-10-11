import EditarTarefa from "../source/useCases/EditarTarefa/EditarTarefa";
import StatusTarefa from "../source/domain/Enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/Enum/PrioridadeTarefa";
import { criarContexto, criarTarefa, dataInicio, dataFim } from "./fixtures";

test("edita os dados de uma tarefa existente", async () => {
  const { factory, membro } = await criarContexto();
  const tarefa = await criarTarefa(factory, membro);

  const atualizada = await new EditarTarefa(factory).execute({
    codigo: tarefa.codigo,
    titulo: "Tarefa Atualizada",
    dataInicio,
    dataFim,
    status: StatusTarefa.PENDENTE,
    prioridade: PrioridadeTarefa.P1,
    codigosResponsaveis: [membro.codigo],
  });

  expect(atualizada.titulo).toBe("Tarefa Atualizada");
  expect(atualizada.prioridade).toBe(PrioridadeTarefa.P1);
});
