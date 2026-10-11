import ExcluirTarefa from "../source/useCases/ExcluirTarefa/ExcluirTarefa";
import { criarContexto, criarTarefa } from "./fixtures";

test("exclui uma tarefa existente", async () => {
  const { factory, membro } = await criarContexto();
  const tarefa = await criarTarefa(factory, membro);

  await new ExcluirTarefa(factory).execute(tarefa.codigo);

  expect(await factory.criarTarefaRepository().listar()).toHaveLength(0);
});
