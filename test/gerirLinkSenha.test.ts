import { compare } from "bcrypt";
import Usuario from "../source/domain/entity/Usuario";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import GerirLinkSenha from "../source/useCases/auth/GerirLinkSenha";
import { hashToken } from "../source/useCases/auth/emitirSessao";
import { emitirSessao } from "../source/useCases/auth/emitirSessao";

const SENHA = "Konvex@123";

describe("GerirLinkSenha", () => {
    let factory: MemoryRepositoryFactory;
    let caso: GerirLinkSenha;
    let ana: Usuario;

    beforeEach(async () => {
        factory = new MemoryRepositoryFactory();
        caso = new GerirLinkSenha(factory);
        ana = new Usuario("Ana Souza", "ana@x.com", PerfilUsuario.MEMBRO, true, "", new SenioridadeUsuario("pleno", "Pleno", 75));
        await factory.criarUsuarioRepository().criar(ana);
    });

    const token = () => factory.envioEmail.ultimoLink("ana@x.com") as string;

    test("emitir convite envia e-mail com link e consultar devolve tipo e primeiro nome", async () => {
        expect(ana.convitePendente).toBe(true);
        expect(JSON.stringify(ana)).not.toContain('senha"');
        expect(await caso.emitir(ana, "convite")).toBe(true);
        expect(factory.envioEmail.enviados).toHaveLength(1);
        expect(await caso.consultar(token())).toEqual({ tipo: "convite", primeiroNome: "Ana" });
    });

    test("senha fraca não gasta o link; confirmação diferente também não", async () => {
        await caso.emitir(ana, "convite");
        await expect(caso.usar(token(), "fraca", "fraca")).rejects.toMatchObject({ codigo: "SENHA_FRACA" });
        await expect(caso.usar(token(), SENHA, "Outra@123")).rejects.toMatchObject({ codigo: "SENHA_CONFIRMACAO_DIFERENTE" });
        expect(await caso.consultar(token())).toMatchObject({ tipo: "convite" });
    });

    test("usar grava a senha, devolve sessão, avisa por e-mail e o link não serve de novo", async () => {
        await caso.emitir(ana, "convite");
        const t = token();
        const sessao = await caso.usar(t, SENHA, SENHA);
        expect(sessao.token).toBeDefined();
        const salvo = (await factory.criarUsuarioRepository().buscarPorCodigo(ana.codigo))!;
        expect(await compare(SENHA, salvo.senha)).toBe(true);
        expect(salvo.convitePendente).toBe(false);
        expect(factory.envioEmail.enviados[factory.envioEmail.enviados.length - 1].assunto).toBe("Sua senha foi alterada");
        await expect(caso.usar(t, SENHA, SENHA)).rejects.toMatchObject({ codigo: "LINK_SENHA_INVALIDO" });
        await expect(caso.consultar(t)).rejects.toMatchObject({ codigo: "LINK_SENHA_INVALIDO" });
    });

    test("novo link do mesmo tipo invalida o anterior", async () => {
        await caso.emitir(ana, "redefinir");
        const primeiro = token();
        await caso.emitir(ana, "redefinir");
        await expect(caso.consultar(primeiro)).rejects.toMatchObject({ codigo: "LINK_SENHA_INVALIDO" });
        expect(await caso.consultar(token())).toMatchObject({ tipo: "redefinir" });
    });

    test("usar um link invalida os outros da pessoa e revoga as sessões antigas", async () => {
        await caso.emitir(ana, "convite");
        const convite = token();
        await caso.emitir(ana, "redefinir");
        const antiga = await emitirSessao(factory, ana);
        await caso.usar(token(), SENHA, SENHA);
        await expect(caso.consultar(convite)).rejects.toMatchObject({ codigo: "LINK_SENHA_INVALIDO" });
        const registro = await factory.criarRefreshTokenRepository().buscarPorHash(hashToken(antiga.refreshToken));
        expect(registro?.revogadoEm).not.toBeNull();
    });

    test("link vencido é inválido", async () => {
        await caso.emitir(ana, "redefinir");
        const t = token();
        jest.useFakeTimers({ now: Date.now() + 61 * 60 * 1000 });
        try {
            await expect(caso.consultar(t)).rejects.toMatchObject({ codigo: "LINK_SENHA_INVALIDO" });
            await expect(caso.usar(t, SENHA, SENHA)).rejects.toMatchObject({ codigo: "LINK_SENHA_INVALIDO" });
        } finally {
            jest.useRealTimers();
        }
    });

    test("convite vale mais de 1 hora (72 h)", async () => {
        await caso.emitir(ana, "convite");
        const t = token();
        jest.useFakeTimers({ now: Date.now() + 71 * 60 * 60 * 1000 });
        try {
            expect(await caso.consultar(t)).toMatchObject({ tipo: "convite" });
        } finally {
            jest.useRealTimers();
        }
    });

    test("pessoa que ficou inativa tem link inválido", async () => {
        await caso.emitir(ana, "redefinir");
        const t = token();
        await factory.criarUsuarioRepository().editar(ana.copiar({ status: StatusPessoa.INATIVO }));
        await expect(caso.consultar(t)).rejects.toMatchObject({ codigo: "LINK_SENHA_INVALIDO" });
        await expect(caso.usar(t, SENHA, SENHA)).rejects.toMatchObject({ codigo: "LINK_SENHA_INVALIDO" });
    });

    test("token desconhecido é inválido", async () => {
        await expect(caso.consultar("naoexiste")).rejects.toMatchObject({ codigo: "LINK_SENHA_INVALIDO" });
    });

    test("falha no envio devolve false; falha no aviso de senha alterada não derruba o uso", async () => {
        factory.envioEmail.falhar = true;
        expect(await caso.emitir(ana, "convite")).toBe(false);
        factory.envioEmail.falhar = false;
        await caso.emitir(ana, "convite");
        const t = token();
        factory.envioEmail.falhar = true;
        await expect(caso.usar(t, SENHA, SENHA)).resolves.toBeDefined();
    });
});
