import RepositoryFactoryInterface from "../source/domain/interfaces/RepositoryFactoryInterface";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import CriarUsuario from "../source/useCases/pessoas/CriarUsuario";
import { cadastrarComSenha } from "./fixtures";
import LoginUsuario, { MENSAGEM_CREDENCIAIS_INVALIDAS } from "../source/useCases/auth/LoginUsuario";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";

describe("Caso de uso LoginUsuario", () => {
    let repositoryFactory: RepositoryFactoryInterface;
    let loginUsuario: LoginUsuario;

    const senhaUsuario = "Konvex@123";
    const dadosUsuario = {
        nome: "John",
        email: "john.doe@gmail.com.br",
        perfil: PerfilUsuario.MEMBRO,
        senioridade: new SenioridadeUsuario("pleno", "Pleno", 75),
    };

    beforeEach(() => {
        repositoryFactory = new MemoryRepositoryFactory();
        loginUsuario = new LoginUsuario(repositoryFactory);
    });

    test("Deve gerar um token para usuário válido", async () => {
        await cadastrarComSenha(repositoryFactory as any, dadosUsuario, senhaUsuario);

        const output = await loginUsuario.execute({
            email: dadosUsuario.email,
            senha: senhaUsuario,
        });

        expect(output.token).toBeDefined();
    });

    test("Deve aceitar e-mail com maiúsculas e espaços", async () => {
        await cadastrarComSenha(repositoryFactory as any, dadosUsuario, senhaUsuario);

        const output = await loginUsuario.execute({
            email: "  John.Doe@Gmail.com.br ",
            senha: senhaUsuario,
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
        await cadastrarComSenha(repositoryFactory as any, dadosUsuario, senhaUsuario);

        await expect(
            loginUsuario.execute({
                email: dadosUsuario.email,
                senha: "senhaErrada",
            }),
        ).rejects.toThrow(MENSAGEM_CREDENCIAIS_INVALIDAS);
    });

    test("Não deve permitir login de usuário inativo", async () => {
        await new CriarUsuario(repositoryFactory).execute({ ...dadosUsuario, ativo: false });

        await expect(
            loginUsuario.execute({
                email: dadosUsuario.email,
                senha: senhaUsuario,
            }),
        ).rejects.toThrow(MENSAGEM_CREDENCIAIS_INVALIDAS);
    });
});
