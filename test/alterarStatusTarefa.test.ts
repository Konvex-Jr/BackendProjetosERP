import AlterarStatusTarefa from "../source/useCases/AlterarStatusTarefa/AlterarStatusTarefa";
import StatusTarefa from "../source/domain/Enum/StatusTarefa";
import { criarContexto, criarTarefa } from "./fixtures";

test("altera o status e registra a data de conclusão da tarefa", async () => {
  const { factory, membro } = await criarContexto();
  const tarefa = await criarTarefa(factory, membro);
  const dataConclusao = new Date("2026-10-20T00:00:00.000Z");

  const atualizada = await new AlterarStatusTarefa(factory).execute(
    tarefa.codigo,
    StatusTarefa.CONCLUIDA,
    dataConclusao,
  );

  expect(atualizada.status).toBe(StatusTarefa.CONCLUIDA);
  expect(atualizada.dataConclusao).toEqual(dataConclusao);
});
