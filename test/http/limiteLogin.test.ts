import CriarUsuario from "../../source/useCases/pessoas/CriarUsuario";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Auditoria de 13/11/2026: o login limita as tentativas erradas por e-mail e IP. */
describe("Limite de tentativas no login", () => {
    let servidor: Awaited<ReturnType<typeof subirServidor>>;

    beforeEach(async () => {
        const ctx = await criarContexto();
        await new CriarUsuario(ctx.factory).execute({
            nome: "Carla",
            email: "carla@konvex.com.br",
            senha: "senha-certa-123",
            perfil: PerfilUsuario.GERENTE,
            senioridade: ctx.senioridade,
        });
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const entrar = (email: string, senha: string) => servidor.chamar("post", "/auth/login", { corpo: { email, senha } });

    it("depois de 5 senhas erradas responde 429, mesmo com a senha certa", async () => {
        for (let i = 0; i < 5; i++) expect((await entrar("carla@konvex.com.br", "errada")).status).toBe(401);
        const bloqueado = await entrar("carla@konvex.com.br", "senha-certa-123");
        expect(bloqueado.status).toBe(429);
        expect(bloqueado.corpo.codigo).toBe("MUITAS_TENTATIVAS");
        expect(bloqueado.corpo.message).toMatch(/minuto/);
    });

    it("o bloqueio vale só para o e-mail errado; login certo zera a contagem", async () => {
        for (let i = 0; i < 4; i++) await entrar("carla@konvex.com.br", "errada");
        expect((await entrar("carla@konvex.com.br", "senha-certa-123")).status).toBe(200);
        for (let i = 0; i < 4; i++) expect((await entrar("carla@konvex.com.br", "errada")).status).toBe(401);
        expect((await entrar("outra@konvex.com.br", "errada")).status).toBe(401);
    });

    it("respostas da API levam cabeçalhos de segurança e não dizem que é Express", async () => {
        const r = await entrar("carla@konvex.com.br", "errada");
        expect(r.headers.get("x-content-type-options")).toBe("nosniff");
        expect(r.headers.get("x-frame-options")).toBe("DENY");
        expect(r.headers.get("x-powered-by")).toBeNull();
    });
});
