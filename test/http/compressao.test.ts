import { criarContexto, criarProjeto, criarTarefa } from "../fixtures";
import { subirServidor } from "./servidorTeste";

describe("Compressão das respostas", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    const gzip = { "Accept-Encoding": "gzip" };

    beforeEach(async () => {
        ctx = await criarContexto();
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    async function criarVariasTarefas() {
        const projeto = await criarProjeto(ctx.factory, ctx.membro);
        for (let i = 0; i < 15; i++) await criarTarefa(ctx.factory, ctx.membro, projeto);
    }

    it("lista grande sai comprimida", async () => {
        await criarVariasTarefas();
        const r = await servidor.chamar("get", "/tarefas", { usuario: ctx.membro, cabecalhos: gzip });
        expect(r.status).toBe(200);
        expect(r.headers.get("content-encoding")).toBe("gzip");
        expect(Array.isArray(r.corpo) ? r.corpo.length : r.corpo).toBeTruthy();
    });

    it("sem Accept-Encoding, sai sem compressão", async () => {
        await criarVariasTarefas();
        const r = await servidor.chamar("get", "/tarefas", {
            usuario: ctx.membro,
            // o fetch do Node envia gzip por conta própria; "identity" pede a resposta sem compressão
            cabecalhos: { "Accept-Encoding": "identity" },
        });
        expect(r.status).toBe(200);
        expect(r.headers.get("content-encoding")).toBeNull();
    });

    it("/auth/login nunca sai comprimido", async () => {
        const r = await servidor.chamar("post", "/auth/login", {
            corpo: { email: "ninguem@konvex.com.br", senha: "errada" },
            cabecalhos: gzip,
        });
        expect(r.headers.get("content-encoding")).toBeNull();
    });
});
