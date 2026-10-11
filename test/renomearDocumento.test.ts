import RenomearDocumento from "../source/useCases/RenomearDocumento/RenomearDocumento";
import { criarContexto, criarDocumento } from "./fixtures";

test("renomeia um documento existente", async () => {
  const { factory, membro } = await criarContexto();
  const documento = await criarDocumento(factory, membro);

  const atualizado = await new RenomearDocumento(factory).execute(documento.codigo, "ata-final");

  expect(atualizado.nome).toBe("ata-final");
});
