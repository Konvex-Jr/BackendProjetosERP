import { ErroConflito } from "../source/shared/erros/ErroConflito";
import RepositoryFactoryInterface from "../source/domain/interfaces/RepositoryFactoryInterface";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import EditarUsuario from "../source/useCases/pessoas/EditarUsuario";
import EnvioEmailMemoria from "../source/infra/email/EnvioEmailMemoria";
import CriarUsuario from "../source/useCases/pessoas/CriarUsuario";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";
import { ErroValidacao } from "../source/shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../source/shared/erros/mensagensDeErro";

let repositoryFactory: RepositoryFactoryInterface;
let criarUsuario: CriarUsuario;

const senioridadePleno = new SenioridadeUsuario("pleno", "Pleno", 75);

const inputValido = {
    nome: "John",
    email: "john.doe@konvex.com.br",
    perfil: PerfilUsuario.MEMBRO,
    senioridade: senioridadePleno,
};

beforeEach(() => {
    repositoryFactory = new MemoryRepositoryFactory();
    criarUsuario = new CriarUsuario(repositoryFactory);
});

test("Deve criar um usuário membro", async () => {
    const output = await criarUsuario.execute(inputValido);
    expect(output.usuario.codigo).toBeTruthy();
});

test("Deve criar um usuário gerente com senioridade", async () => {
    const output = await criarUsuario.execute({
        ...inputValido,
        perfil: PerfilUsuario.GERENTE,
        senioridade: senioridadePleno,
    });
    expect(output.usuario.codigo).toBeTruthy();
});

test("Cria sem senha: convite pendente e e-mail de convite enviado", async () => {
    const { usuario, conviteEnviado } = await criarUsuario.execute(inputValido);
    expect(usuario.convitePendente).toBe(true);
    expect(usuario.senha).toBe("");
    expect(conviteEnviado).toBe(true);
    const envio = repositoryFactory.criarEnvioEmail() as EnvioEmailMemoria;
    expect(envio.enviados).toHaveLength(1);
    expect(envio.ultimoLink("john.doe@konvex.com.br")).toBeTruthy();
});

test("Falha no envio não desfaz o cadastro", async () => {
    (repositoryFactory.criarEnvioEmail() as EnvioEmailMemoria).falhar = true;
    const { conviteEnviado } = await criarUsuario.execute(inputValido);
    expect(conviteEnviado).toBe(false);
    expect(await repositoryFactory.criarUsuarioRepository().buscarPorEmail("john.doe@konvex.com.br")).not.toBeNull();
});

describe("domínio do e-mail", () => {
    afterEach(() => {
        delete process.env.EMAIL_DOMINIO;
    });

    test("e-mail de fora do domínio dá 400 EMAIL_FORA_DO_DOMINIO", async () => {
        process.env.EMAIL_DOMINIO = "konvexjr.com.br";
        const promessa = criarUsuario.execute({ ...inputValido, email: "x@gmail.com" });
        await expect(promessa).rejects.toBeInstanceOf(ErroValidacao);
        await expect(promessa).rejects.toMatchObject({
            codigo: "EMAIL_FORA_DO_DOMINIO",
            message: "Use o e-mail da Konvex (@konvexjr.com.br).",
        });
    });

    test("aceita o domínio sem diferenciar maiúsculas nem espaços", async () => {
        process.env.EMAIL_DOMINIO = "konvexjr.com.br";
        const { usuario } = await criarUsuario.execute({ ...inputValido, email: " Ana@KonvexJr.com.br " });
        expect(usuario.email).toBe("ana@konvexjr.com.br");
    });

    test("editar outro campo de pessoa antiga fora do domínio funciona; trocar para fora não", async () => {
        const { usuario } = await criarUsuario.execute({ ...inputValido, email: "antigo@gmail.com" });
        process.env.EMAIL_DOMINIO = "konvexjr.com.br";
        const editar = new EditarUsuario(repositoryFactory);
        await expect(editar.execute({ codigo: usuario.codigo, nome: "Novo Nome" })).resolves.toBeTruthy();
        await expect(editar.execute({ codigo: usuario.codigo, email: "outro@gmail.com" })).rejects.toMatchObject({
            codigo: "EMAIL_FORA_DO_DOMINIO",
        });
    });
});

test("Não deve criar um membro sem senioridade", async () => {
    const promessa = criarUsuario.execute({ ...inputValido, senioridade: null });
    await expect(promessa).rejects.toBeInstanceOf(ErroValidacao);
    await expect(promessa).rejects.toThrow(MENSAGENS_DE_ERRO.VALIDACAO.SENIORIDADE_OBRIGATORIA);
});

test("Não deve criar um diretor ou gerente sem senioridade", async () => {
    const promessa = criarUsuario.execute({
        ...inputValido,
        perfil: PerfilUsuario.GERENTE,
        senioridade: null,
    });
    await expect(promessa).rejects.toBeInstanceOf(ErroValidacao);
    await expect(promessa).rejects.toThrow(MENSAGENS_DE_ERRO.VALIDACAO.SENIORIDADE_OBRIGATORIA);
});

test("Não deve criar dois usuários com o mesmo e-mail (sem diferenciar maiúsculas)", async () => {
    await criarUsuario.execute(inputValido);
    const promessa = criarUsuario.execute({
        ...inputValido,
        email: "John.Doe@Konvex.com.br",
    });
    // 409, como ao editar (revisão de arquitetura, 12/11/2026).
    await expect(promessa).rejects.toBeInstanceOf(ErroConflito);
});

test("Deve verificar se há registros no repositório", async () => {
    const usuarioRepository = repositoryFactory.criarUsuarioRepository();
    expect(await usuarioRepository.listar()).toHaveLength(0);

    await criarUsuario.execute(inputValido);

    expect(await usuarioRepository.listar()).toHaveLength(1);
});
