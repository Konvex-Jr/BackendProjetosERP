import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { CATEGORIAS_CONHECIMENTO } from "../../source/domain/enum/CategoriaConhecimento";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 12a (03/11/2026): Base de Inteligência. Todos leem e cadastram; autor ou gestão alteram. */
describe("Base de Inteligência", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let bruno: Usuario;

    const novo = (usuario: Usuario, corpo: Record<string, unknown>) =>
        servidor.chamar("post", "/conhecimento", { usuario, corpo: { categoria: "pesquisa", resumo: "Resumo", ...corpo } });
    const titulos = (corpo: any[]) => corpo.map((i) => i.titulo).sort();

    beforeEach(async () => {
        ctx = await criarContexto();
        bruno = new Usuario("Bruno", "bruno@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-bruno");
        await ctx.factory.criarUsuarioRepository().criar(bruno);
        await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("App Delivery", "d", dataInicio, dataFim, undefined, [ctx.membro], "proj-app"));
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("lista as 13 categorias do RF-081 com rótulo", async () => {
        const r = await servidor.chamar("get", "/conhecimento/categorias", { usuario: bruno });
        expect(r.status).toBe(200);
        expect(r.corpo).toHaveLength(13);
        expect(r.corpo).toEqual(CATEGORIAS_CONHECIMENTO);
    });

    it("membro cadastra uma pesquisa ligada a um projeto e vira o autor", async () => {
        const r = await novo(ctx.membro, {
            titulo: "Pesquisa de concorrentes",
            conteudo: "## Achados\n- iFood domina",
            tags: ["Mercado", "#delivery", "mercado"],
            links: ["https://exemplo.com/relatorio"],
            codigosProjetos: ["proj-app"],
            data: "2026-10-20",
        });
        expect(r.status).toBe(200);
        expect(r.corpo.autor).toEqual({ codigo: "usr-ana", nome: "Ana Silva" });
        expect(r.corpo.tags).toEqual(["mercado", "delivery"]);
        expect(r.corpo.projetos).toEqual([{ codigo: "proj-app", nome: "App Delivery" }]);
        expect(r.corpo.podeAlterar).toBe(true);
        expect(r.corpo.data).toBe("2026-10-20T00:00:00.000Z");
    });

    it("outro membro encontra pela busca, pela tag e pelo filtro de projeto", async () => {
        await novo(ctx.membro, {
            titulo: "Pesquisa de concorrentes",
            conteudo: "O iFood domina",
            tags: ["delivery"],
            codigosProjetos: ["proj-app"],
        });
        await novo(ctx.gerente, { titulo: "Como fazer onboarding", categoria: "aprendizado", resumo: "Passos" });

        const busca = await servidor.chamar("get", "/conhecimento?busca=IFOOD", { usuario: bruno });
        expect(titulos(busca.corpo)).toEqual(["Pesquisa de concorrentes"]);
        expect(busca.corpo[0].podeAlterar).toBe(false);
        expect(titulos((await servidor.chamar("get", "/conhecimento?busca=deliv", { usuario: bruno })).corpo)).toEqual([
            "Pesquisa de concorrentes",
        ]);
        expect(titulos((await servidor.chamar("get", "/conhecimento?tag=delivery", { usuario: bruno })).corpo)).toEqual([
            "Pesquisa de concorrentes",
        ]);
        expect(titulos((await servidor.chamar("get", "/conhecimento?codigoProjeto=proj-app", { usuario: bruno })).corpo)).toEqual([
            "Pesquisa de concorrentes",
        ]);
        expect(titulos((await servidor.chamar("get", "/conhecimento?categoria=aprendizado", { usuario: bruno })).corpo)).toEqual([
            "Como fazer onboarding",
        ]);
        expect(titulos((await servidor.chamar("get", "/conhecimento?codigoAutor=usr-joao", { usuario: bruno })).corpo)).toEqual([
            "Como fazer onboarding",
        ]);
        expect((await servidor.chamar("get", "/conhecimento", { usuario: bruno })).corpo).toHaveLength(2);
    });

    it("filtra por período pela data do item e recusa período invertido", async () => {
        await novo(ctx.membro, { titulo: "Antigo", data: "2026-01-10" });
        await novo(ctx.membro, { titulo: "Recente", data: "2026-10-10" });
        const r = await servidor.chamar("get", "/conhecimento?de=2026-10-01&ate=2026-10-31", { usuario: bruno });
        expect(titulos(r.corpo)).toEqual(["Recente"]);
        const lista = (await servidor.chamar("get", "/conhecimento", { usuario: bruno })).corpo;
        expect(lista.map((i: any) => i.titulo)).toEqual(["Recente", "Antigo"]);
        expect((await servidor.chamar("get", "/conhecimento?de=2026-10-31&ate=2026-10-01", { usuario: bruno })).status).toBe(400);
        expect((await servidor.chamar("get", "/conhecimento?de=ontem", { usuario: bruno })).status).toBe(400);
    });

    it("autor edita e exclui o próprio; outro membro recebe 403; gestão altera qualquer um", async () => {
        const item = (await novo(ctx.membro, { titulo: "Benchmark", codigosProjetos: ["proj-app"] })).corpo;
        const editar = (usuario: Usuario, titulo: string) =>
            servidor.chamar("put", `/conhecimento/${item.codigo}`, { usuario, corpo: { titulo, categoria: "benchmark", resumo: "R" } });

        const alheio = await editar(bruno, "Invadido");
        expect(alheio.status).toBe(403);
        expect(alheio.corpo.message).toMatch(/quem cadastrou/);
        expect((await servidor.chamar("delete", `/conhecimento/${item.codigo}`, { usuario: bruno })).status).toBe(403);

        const proprio = await editar(ctx.membro, "Benchmark v2");
        expect(proprio.status).toBe(200);
        expect(proprio.corpo.categoria).toBe("benchmark");
        expect(proprio.corpo.projetos).toEqual([]); // PUT substitui a lista de projetos
        expect(proprio.corpo.autor.codigo).toBe("usr-ana");

        expect((await editar(ctx.gerente, "Benchmark (revisado)")).status).toBe(200);
        expect((await servidor.chamar("get", `/conhecimento/${item.codigo}`, { usuario: bruno })).corpo.titulo).toBe(
            "Benchmark (revisado)",
        );
        expect((await servidor.chamar("delete", `/conhecimento/${item.codigo}`, { usuario: ctx.gerente })).status).toBe(200);
        expect((await servidor.chamar("get", `/conhecimento/${item.codigo}`, { usuario: bruno })).status).toBe(404);
    });

    it("valida campos com mensagem que diz o que corrigir", async () => {
        const casos: Array<[Record<string, unknown>, RegExp]> = [
            [{ titulo: "" }, /título do item é obrigatório/],
            [{ titulo: "X", resumo: "" }, /resumo do item é obrigatório/],
            [{ titulo: "X", categoria: "fofoca" }, /Categoria inválida.*pesquisa/],
            [{ titulo: "X", links: ["ftp://x"] }, /Link inválido: ftp:\/\/x/],
            [{ titulo: "X", tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, /no máximo 10 tags/],
            [{ titulo: "X", data: "amanhã" }, /data deve ser uma data válida/],
            [{ titulo: "X", tags: 5 }, /tags deve ser uma lista/],
        ];
        for (const [corpo, mensagem] of casos) {
            const r = await novo(ctx.membro, corpo);
            expect(r.status).toBe(400);
            expect(r.corpo.message).toMatch(mensagem);
        }
        const semProjeto = await novo(ctx.membro, { titulo: "X", codigosProjetos: ["nao-existe"] });
        expect(semProjeto.status).toBe(404);
    });

    it("exige login e devolve 404 para item inexistente", async () => {
        expect((await servidor.chamar("get", "/conhecimento")).status).toBe(401);
        expect((await servidor.chamar("get", "/conhecimento/nao-existe", { usuario: bruno })).status).toBe(404);
        expect((await servidor.chamar("put", "/conhecimento/nao-existe", { usuario: ctx.gerente, corpo: { titulo: "X" } })).status).toBe(
            404,
        );
    });

    it("aparece no menu de todos, depois de Capacitações", async () => {
        const menu = (await servidor.chamar("get", "/auth/permissoes", { usuario: bruno })).corpo.menu.map((m: any) => m.chave);
        expect(menu.indexOf("conhecimento")).toBe(menu.indexOf("capacitacoes") + 1);
        const gestao = (await servidor.chamar("get", "/auth/permissoes", { usuario: ctx.gerente })).corpo.permissoes;
        expect(gestao).toContain("conhecimento.gerir");
    });
});
