import RenomearPasta from "../source/useCases/RenomearPasta/RenomearPasta";
import { criarContexto, criarPasta } from "./fixtures";

test("renomeia uma pasta existente", async () => {
  const { factory } = await criarContexto();
  const pasta = await criarPasta(factory);

  const atualizada = await new RenomearPasta(factory).execute(pasta.codigo, "Arquivos");

  expect(atualizada.nome).toBe("Arquivos");
});
