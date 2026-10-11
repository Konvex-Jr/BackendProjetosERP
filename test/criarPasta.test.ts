import CriarPasta from "../source/useCases/CriarPasta/CriarPasta";
import { criarContexto } from "./fixtures";

test("cria uma pasta e remove espaços excedentes do nome", async () => {
  const { factory } = await criarContexto();

  const pasta = await new CriarPasta(factory).execute(" Documentos ");

  expect(pasta.nome).toBe("Documentos");
});
