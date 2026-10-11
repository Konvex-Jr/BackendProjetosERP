import ExcluirDocumento from "../source/useCases/ExcluirDocumento/ExcluirDocumento";
import { criarContexto, criarDocumento } from "./fixtures";

test("exclui um documento existente", async () => {
  const { factory, membro } = await criarContexto();
  const documento = await criarDocumento(factory, membro);

  await new ExcluirDocumento(factory).execute(documento.codigo);

  expect(await factory.criarDocumentoRepository().contarPorPasta(documento.pasta.codigo)).toBe(0);
});
