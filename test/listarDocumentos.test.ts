import ListarDocumentos from "../source/useCases/ListarDocumentos/ListarDocumentos";
import { criarContexto, criarDocumento } from "./fixtures";

test("lista documentos de uma pasta", async () => {
  const { factory, membro } = await criarContexto();
  const documento = await criarDocumento(factory, membro);

  const documentos = await new ListarDocumentos(factory).execute(documento.pasta.codigo);

  expect(documentos).toHaveLength(1);
  expect(documentos[0].codigo).toBe(documento.codigo);
});
