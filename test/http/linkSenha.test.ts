import EnvioEmailMemoria from "../../source/infra/email/EnvioEmailMemoria";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { cadastrarComSenha, criarContexto } from "../fixtures";
import { subirServidor } from "./servidorTeste";

describe("Esqueci a senha e link de senha (HTTP)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let envio: EnvioEmailMemoria;

    beforeEach(async () => {
        ctx = await criarContexto();
        await cadastrarComSenha(
            ctx.factory,
            {
                nome: "Ana Dev",
                email: "ana@dev.konvex",
                perfil: PerfilUsuario.MEMBRO,
                senioridade: ctx.senioridade,
                curso: "Engenharia Mecânica",
            },
            "Senha@antiga1",
        );
        envio = ctx.factory.criarEnvioEmail() as EnvioEmailMemoria;
        envio.enviados.length = 0;
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const pedir = (email: unknown) => servidor.chamar("post", "/auth/esqueci-senha", { corpo: { email } });

    it("e-mail cadastrado e inexistente dão a mesma resposta", async () => {
        const a = await pedir("ana@dev.konvex");
        const b = await pedir("ninguem@dev.konvex");
        expect([a.status, a.corpo]).toEqual([b.status, b.corpo]);
        expect(a.status).toBe(200);
        expect(a.corpo.message).toBe("Se o e-mail estiver cadastrado, você vai receber um link em instantes.");
    });

    it("acha a pessoa com maiúsculas e espaços e envia o link", async () => {
        await pedir(" Ana@Dev.Konvex ");
        await new Promise((r) => setTimeout(r, 50));
        expect(envio.ultimoLink("ana@dev.konvex")).toBeTruthy();
        expect(envio.enviados).toHaveLength(1);
    });

    it("o 11º pedido do mesmo IP responde 429", async () => {
        for (let i = 0; i < 10; i++) expect((await pedir("ninguem@dev.konvex")).status).toBe(200);
        const r = await pedir("ninguem@dev.konvex");
        expect(r.status).toBe(429);
        expect(r.corpo.codigo).toBe("MUITAS_TENTATIVAS");
    });

    it("GET de token inválido dá 400 LINK_SENHA_INVALIDO", async () => {
        const r = await servidor.chamar("get", "/auth/link-senha/invalido");
        expect(r.status).toBe(400);
        expect(r.corpo.codigo).toBe("LINK_SENHA_INVALIDO");
    });

    it("link certo: consulta, define a senha e a sessão abre /auth/me", async () => {
        await pedir("ana@dev.konvex");
        await new Promise((r) => setTimeout(r, 50));
        const token = envio.ultimoLink("ana@dev.konvex")!;
        const consulta = await servidor.chamar("get", `/auth/link-senha/${token}`);
        expect(consulta.corpo).toEqual({ tipo: "redefinir", primeiroNome: "Ana" });

        const r = await servidor.chamar("post", `/auth/link-senha/${token}`, {
            corpo: { senha: "Senha@nova123", confirmacao: "Senha@nova123" },
        });
        expect(r.status).toBe(200);
        expect(r.corpo.refreshToken).toBeTruthy();
        expect(r.corpo.usuario.email).toBe("ana@dev.konvex");
        const eu = await servidor.chamar("get", "/auth/me", { cabecalhos: { "access-token": r.corpo.token } });
        expect(eu.status).toBe(200);

        const login = await servidor.chamar("post", "/auth/login", { corpo: { email: "ana@dev.konvex", senha: "Senha@nova123" } });
        expect(login.status).toBe(200);
        expect(
            (await servidor.chamar("post", `/auth/link-senha/${token}`, { corpo: { senha: "Outra@senha1", confirmacao: "Outra@senha1" } }))
                .status,
        ).toBe(400);
    });
});
