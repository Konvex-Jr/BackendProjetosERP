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

    describe("rotas de teste com corpo grande (> 1 KB)", () => {
        const grande = { texto: "x".repeat(3000) };

        beforeEach(async () => {
            for (const caminho of ["/auth/grande", "/outra/grande"]) {
                await servidor.http.route("get", caminho, false, async () => grande);
            }
        });

        it.each(["/auth/grande", "/Auth/grande", "/AUTH/grande"])("%s nunca sai comprimido", async (caminho) => {
            const r = await servidor.chamar("get", caminho, { cabecalhos: gzip });
            expect(r.status).toBe(200);
            expect(r.headers.get("content-encoding")).toBeNull();
        });

        it("controle positivo: mesmo corpo fora de /auth sai comprimido", async () => {
            const r = await servidor.chamar("get", "/outra/grande", { cabecalhos: gzip });
            expect(r.headers.get("content-encoding")).toBe("gzip");
        });

        it("/authx não é /auth e comprime normalmente", async () => {
            await servidor.http.route("get", "/authx", false, async () => grande);
            const r = await servidor.chamar("get", "/authx", { cabecalhos: gzip });
            expect(r.headers.get("content-encoding")).toBe("gzip");
        });
    });
});
