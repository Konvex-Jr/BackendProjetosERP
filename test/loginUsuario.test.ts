import RepositoryFactoryInterface from "../source/domain/Interfaces/RepositoryFactoryInterface";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import CriarUsuario from "../source/useCases/CriarUsuario/CriarUsuario";
import LoginUsuario, {
  MENSAGEM_CREDENCIAIS_INVALIDAS,
} from "../source/useCases/LoginUsuario/LoginUsuario";
import PerfilUsuario from "../source/domain/Enum/PerfilUsuario";
import SenioridadeUsuario from "../source/domain/Entity/SenioridadeUsuario";

describe("Caso de uso LoginUsuario", () => {
  let repositoryFactory: RepositoryFactoryInterface;
  let criarUsuario: CriarUsuario;
  let loginUsuario: LoginUsuario;

  const dadosUsuario = {
    nome: "John",
    email: "john.doe@gmail.com.br",
    senha: "senha123",
    perfil: PerfilUsuario.MEMBRO,
    senioridade: new SenioridadeUsuario("pleno", "Pleno", 75),
  };

  beforeEach(() => {
    repositoryFactory = new MemoryRepositoryFactory();
    criarUsuario = new CriarUsuario(repositoryFactory);
    loginUsuario = new LoginUsuario(repositoryFactory);
  });

  test("Deve gerar um token para usuário válido", async () => {
    await criarUsuario.execute(dadosUsuario);

    const output = await loginUsuario.execute({
      email: dadosUsuario.email,
      senha: dadosUsuario.senha,
    });

    expect(output.token).toBeDefined();
  });

  test("Deve aceitar e-mail com maiúsculas e espaços", async () => {
    await criarUsuario.execute(dadosUsuario);

    const output = await loginUsuario.execute({
      email: "  John.Doe@Gmail.com.br ",
      senha: dadosUsuario.senha,
    });

    expect(output.token).toBeDefined();
  });

  test("Deve falhar se o usuário não existir", async () => {
    await expect(
      loginUsuario.execute({
        email: "no.user@gmail.com.br",
        senha: "123456",
      }),
    ).rejects.toThrow(MENSAGEM_CREDENCIAIS_INVALIDAS);
  });

  test("Deve falhar se a senha estiver incorreta", async () => {
    await criarUsuario.execute(dadosUsuario);

    await expect(
      loginUsuario.execute({
        email: dadosUsuario.email,
        senha: "senhaErrada",
      }),
    ).rejects.toThrow(MENSAGEM_CREDENCIAIS_INVALIDAS);
  });

  test("Não deve permitir login de usuário inativo", async () => {
    await criarUsuario.execute({ ...dadosUsuario, ativo: false });

    await expect(
      loginUsuario.execute({
        email: dadosUsuario.email,
        senha: dadosUsuario.senha,
      }),
    ).rejects.toThrow(MENSAGEM_CREDENCIAIS_INVALIDAS);
  });
});