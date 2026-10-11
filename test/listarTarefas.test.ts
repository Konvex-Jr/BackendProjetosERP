import ListarTarefas from "../source/useCases/ListarTarefas/ListarTarefas";
import { criarContexto, criarTarefa } from "./fixtures";

test("lista tarefas por projeto e por responsável", async () => {
  const { factory, membro } = await criarContexto();
  const tarefa = await criarTarefa(factory, membro);

  expect(await new ListarTarefas(factory).execute({ codigoProjeto: tarefa.projeto.codigo })).toHaveLength(1);
  expect(await new ListarTarefas(factory).execute({ codigoResponsavel: membro.codigo })).toHaveLength(1);
});
