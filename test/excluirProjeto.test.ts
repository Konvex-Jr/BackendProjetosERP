import ExcluirProjeto from "../source/useCases/ExcluirProjeto/ExcluirProjeto";
import { criarContexto, criarProjeto, criarTarefa } from "./fixtures";

test("exclui o projeto e as tarefas associadas", async () => {
  const { factory, membro } = await criarContexto();
  const projeto = await criarProjeto(factory, membro);
  await criarTarefa(factory, membro, projeto);

  await new ExcluirProjeto(factory).execute(projeto.codigo);

  expect(await factory.criarProjetoRepository().listar()).toHaveLength(0);
  expect(await factory.criarTarefaRepository().listar()).toHaveLength(0);
});
