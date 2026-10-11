import ExcluirPasta from "../source/useCases/ExcluirPasta/ExcluirPasta";
import { criarContexto, criarPasta } from "./fixtures";

test("exclui uma pasta existente", async () => {
  const { factory } = await criarContexto();
  const pasta = await criarPasta(factory);

  await new ExcluirPasta(factory).execute(pasta.codigo);

  expect(await factory.criarPastaRepository().listar()).toHaveLength(0);
});
