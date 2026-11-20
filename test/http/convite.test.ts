import EnvioEmailMemoria from "../../source/infra/email/EnvioEmailMemoria";
import { criarContexto } from "../fixtures";
import { subirServidor } from "./servidorTeste";

describe("Cadastro por convite (HTTP)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let envio: EnvioEmailMemoria;

    beforeEach(async () => {
        ctx = await criarContexto();
        envio = ctx.factory.criarEnvioEmail() as EnvioEmailMemoria;
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => {
        delete process.env.EMAIL_DOMINIO;
        await servidor.fechar();
    });

    const dados = {
        nome: "Nova Pessoa",
        email: "nova@dev.konvex",
        perfil: "membro",
        codigoSenioridade: "pleno",
        curso: "Engenharia Mecânica",
    };

    it("POST /usuarios cria sem senha e devolve conviteEnviado", async () => {
        const r = await servidor.chamar("post", "/usuarios", { usuario: ctx.gerente, corpo: dados });
        expect(r.status).toBeLessThan(300);
        expect(r.corpo.convitePendente).toBe(true);
        expect(r.corpo.conviteEnviado).toBe(true);
        expect(r.corpo.senha).toBeUndefined();
        expect(envio.ultimoLink("nova@dev.konvex")).toBeTruthy();
    });

    it("com falha no envio a pessoa existe e conviteEnviado é false", async () => {
        envio.falhar = true;
        const r = await servidor.chamar("post", "/usuarios", { usuario: ctx.gerente, corpo: dados });
        expect(r.corpo.conviteEnviado).toBe(false);
        expect(await ctx.factory.criarUsuarioRepository().buscarPorEmail("nova@dev.konvex")).not.toBeNull();
    });

    it("e-mail fora do domínio: 400 EMAIL_FORA_DO_DOMINIO", async () => {
        process.env.EMAIL_DOMINIO = "konvexjr.com.br";
        const r = await servidor.chamar("post", "/usuarios", { usuario: ctx.gerente, corpo: { ...dados, email: "x@gmail.com" } });
        expect(r.status).toBe(400);
        expect(r.corpo.codigo).toBe("EMAIL_FORA_DO_DOMINIO");
    });

    it("PUT /usuarios/:codigo/senha não existe mais", async () => {
        const r = await servidor.chamar("put", `/usuarios/${ctx.membro.codigo}/senha`, {
            usuario: ctx.gerente,
            corpo: { senha: "Senha@nova123" },
        });
        expect(r.status).toBe(404);
    });

    it("POST /usuarios/:codigo/link-senha: membro 403; gerente reenvia o convite", async () => {
        const criada = await servidor.chamar("post", "/usuarios", { usuario: ctx.gerente, corpo: dados });
        const codigo = criada.corpo.codigo;
        expect((await servidor.chamar("post", `/usuarios/${codigo}/link-senha`, { usuario: ctx.membro })).status).toBe(403);
        const r = await servidor.chamar("post", `/usuarios/${codigo}/link-senha`, { usuario: ctx.gerente });
        expect(r.status).toBe(200);
        expect(r.corpo).toEqual({ enviado: true, tipo: "convite" });
        expect(JSON.stringify(r.corpo)).not.toContain("senha/");
    });

    it("pessoa sem acesso: 400 PESSOA_SEM_ACESSO", async () => {
        const criada = await servidor.chamar("post", "/usuarios", { usuario: ctx.gerente, corpo: dados });
        await servidor.chamar("patch", `/usuarios/${criada.corpo.codigo}/status`, {
            usuario: ctx.gerente,
            corpo: { status: "inativo", motivoSaida: "Formou-se" },
        });
        const r = await servidor.chamar("post", `/usuarios/${criada.corpo.codigo}/link-senha`, { usuario: ctx.gerente });
        expect(r.status).toBe(400);
        expect(r.corpo.codigo).toBe("PESSOA_SEM_ACESSO");
    });

    it("status: inativo sem motivo e status inválido dão 400; DELETE sem corpo exige motivo", async () => {
        const criada = await servidor.chamar("post", "/usuarios", { usuario: ctx.gerente, corpo: dados });
        const base = `/usuarios/${criada.corpo.codigo}`;
        const a = await servidor.chamar("patch", `${base}/status`, { usuario: ctx.gerente, corpo: { status: "inativo" } });
        expect([a.status, a.corpo.codigo]).toEqual([400, "MOTIVO_SAIDA_OBRIGATORIO"]);
        const b = await servidor.chamar("patch", `${base}/status`, { usuario: ctx.gerente, corpo: { status: "alumni" } });
        expect([b.status, b.corpo.codigo]).toEqual([400, "STATUS_PESSOA_INVALIDO"]);
        const c = await servidor.chamar("delete", base, { usuario: ctx.gerente });
        expect([c.status, c.corpo.codigo]).toEqual([400, "MOTIVO_SAIDA_OBRIGATORIO"]);
        const d = await servidor.chamar("delete", base, { usuario: ctx.gerente, corpo: { motivoSaida: "Formou-se" } });
        expect(d.status).toBe(200);
    });
});
