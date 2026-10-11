import ListarPastas from "../source/useCases/ListarPastas/ListarPastas";
import { criarContexto, criarPasta } from "./fixtures";

test("lista as pastas cadastradas", async () => {
  const { factory } = await criarContexto();
  await criarPasta(factory);

  expect(await new ListarPastas(factory).execute()).toHaveLength(1);
});
