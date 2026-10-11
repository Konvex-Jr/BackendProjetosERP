import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import Usuario from "../source/domain/Entity/Usuario";
import SenioridadeUsuario from "../source/domain/Entity/SenioridadeUsuario";
import PerfilUsuario from "../source/domain/Enum/PerfilUsuario";
import CriarPasta from "../source/useCases/CriarPasta/CriarPasta";
import ListarPastas from "../source/useCases/ListarPastas/ListarPastas";
import RenomearPasta from "../source/useCases/RenomearPasta/RenomearPasta";
import ExcluirPasta from "../source/useCases/ExcluirPasta/ExcluirPasta";
import EnviarDocumento from "../source/useCases/EnviarDocumento/EnviarDocumento";
import ListarDocumentos from "../source/useCases/ListarDocumentos/ListarDocumentos";
import RenomearDocumento from "../source/useCases/RenomearDocumento/RenomearDocumento";
import ExcluirDocumento from "../source/useCases/ExcluirDocumento/ExcluirDocumento";

describe("Casos de uso de pastas e documentos", () => {
  let factory: MemoryRepositoryFactory;
  let autor: Usuario;
  beforeEach(async () => {
    factory = new MemoryRepositoryFactory();
    autor = new Usuario("Ana", "ana@konvex.com.br", PerfilUsuario.MEMBRO, true, "hash", new SenioridadeUsuario("pleno", "Pleno", 75), "usr-ana");
    await factory.criarUsuarioRepository().criar(autor);
  });

  test("cria, lista e renomeia pasta", async () => {
    const pasta = await new CriarPasta(factory).execute(" Documentos ");
    expect(pasta.nome).toBe("Documentos");
    expect(await new ListarPastas(factory).execute()).toHaveLength(1);
    expect((await new RenomearPasta(factory).execute(pasta.codigo, "Arquivos")).nome).toBe("Arquivos");
  });

  test("envia, lista, renomeia e exclui documento", async () => {
    const pasta = await new CriarPasta(factory).execute("Documentos");
    const documento = await new EnviarDocumento(factory).execute({ codigoPasta: pasta.codigo, nome: "ata", tamanhoBytes: 120, codigoAutor: autor.codigo, arquivoUrl: "https://storage.test/ata.pdf", extensao: "pdf", dataEnvio: new Date("2026-10-10T00:00:00.000Z") });
    expect(documento.extensao).toBe("PDF");
    expect(await new ListarDocumentos(factory).execute(pasta.codigo)).toHaveLength(1);
    expect((await new RenomearDocumento(factory).execute(documento.codigo, "ata-reuniao")).nome).toBe("ata-reuniao");
    await new ExcluirDocumento(factory).execute(documento.codigo);
    expect(await new ListarDocumentos(factory).execute(pasta.codigo)).toHaveLength(0);
  });

  test("exclui pasta e documentos associados", async () => {
    const pasta = await new CriarPasta(factory).execute("Documentos");
    await new EnviarDocumento(factory).execute({ codigoPasta: pasta.codigo, nome: "ata", tamanhoBytes: 120, codigoAutor: autor.codigo, arquivoUrl: "https://storage.test/ata.pdf", extensao: "pdf" });
    await new ExcluirPasta(factory).execute(pasta.codigo);
    expect(await new ListarPastas(factory).execute()).toHaveLength(0);
    await expect(new ListarDocumentos(factory).execute(pasta.codigo)).rejects.toThrow("Pasta não encontrada.");
  });
});
