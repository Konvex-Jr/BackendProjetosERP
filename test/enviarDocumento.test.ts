import EnviarDocumento from "../source/useCases/EnviarDocumento/EnviarDocumento";
import { criarContexto, criarPasta } from "./fixtures";

test("cadastra um documento em uma pasta", async () => {
  const { factory, membro } = await criarContexto();
  const pasta = await criarPasta(factory);

  const documento = await new EnviarDocumento(factory).execute({
    codigoPasta: pasta.codigo,
    nome: "ata-reuniao",
    tamanhoBytes: 120,
    codigoAutor: membro.codigo,
    arquivoUrl: "https://storage.test/ata.pdf",
    extensao: "pdf",
  });

  expect(documento.nome).toBe("ata-reuniao");
  expect(documento.extensao).toBe("PDF");
});
