import Usuario from "../../source/domain/Entity/Usuario";
import Projeto from "../../source/domain/Entity/Projeto";
import PerfilUsuario from "../../source/domain/Enum/PerfilUsuario";
import { criarContexto, criarTarefa, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 8: tarefas pela API (criar, editar, status, responsável, excluir). */
describe("Tarefas pela API", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let colega: Usuario;
    let deFora: Usuario;
    const corpo = (extra: object = {}) => ({
        codigoProjeto: "proj-time",
        titulo: "Levantar requisitos",
        dataInicio: "2026-10-12T12:00:00.000Z",
        dataFim: "2026-10-16T12:00:00.000Z",
        prioridade: "P2",
        ...extra,
    });

    beforeEach(async () => {
        ctx = await criarContexto();
        colega = new Usuario("Bruno", "bruno@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-bruno");
        deFora = new Usuario("Carla", "carla@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-carla");
        await ctx.factory.criarUsuarioRepository().criar(colega);
        await ctx.factory.criarUsuarioRepository().criar(deFora);
        await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("Time", "d", dataInicio, dataFim, undefined, [ctx.membro, colega], "proj-time"));
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("gerente cria, edita, muda status e exclui", async () => {
        const criada = await servidor.chamar("post", "/tarefas", {
            usuario: ctx.gerente,
            corpo: corpo({ codigosResponsaveis: [colega.codigo] }),
        });
        expect(criada.status).toBe(200);
        const codigo = criada.corpo.codigo;

        const editada = await servidor.chamar("put", `/tarefas/${codigo}`, {
            usuario: ctx.gerente,
            corpo: { ...corpo(), titulo: "Requisitos v2", status: "andamento", codigosResponsaveis: [ctx.membro.codigo] },
        });
        expect(editada.status).toBe(200);
        expect(editada.corpo.titulo).toBe("Requisitos v2");
        expect(editada.corpo.responsaveis.map((r: any) => r.codigo)).toEqual([ctx.membro.codigo]);

        const concluida = await servidor.chamar("patch", `/tarefas/${codigo}/status`, {
            usuario: ctx.gerente,
            corpo: { status: "concluida" },
        });
        expect(concluida.status).toBe(200);
        expect(concluida.corpo.dataConclusao).toBeTruthy();

        expect((await servidor.chamar("delete", `/tarefas/${codigo}`, { usuario: ctx.gerente })).status).toBeLessThan(300);
        expect((await servidor.chamar("get", "/tarefas", { usuario: ctx.gerente })).corpo).toEqual([]);
    });

    it("prioridade e situação inválidas dão 400 com mensagem clara (não 500)", async () => {
        const r = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpo({ prioridade: "alta" }) });
        expect(r.status).toBe(400);
        expect(r.corpo.message).toContain("P1, P2, P3 ou P4");

        const criada = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpo() });
        const s = await servidor.chamar("patch", `/tarefas/${criada.corpo.codigo}/status`, {
            usuario: ctx.gerente,
            corpo: { status: "feita" },
        });
        expect(s.status).toBe(400);
        expect(s.corpo.message).toContain("Situação inválida");
    });

    it("responsável precisa estar na equipe do projeto", async () => {
        const r = await servidor.chamar("post", "/tarefas", {
            usuario: ctx.gerente,
            corpo: corpo({ codigosResponsaveis: [deFora.codigo] }),
        });
        expect(r.status).toBe(400);
        expect(r.corpo.message).toContain("Carla");
    });

    it("membro cria no próprio projeto e fica como responsável", async () => {
        const r = await servidor.chamar("post", "/tarefas", {
            usuario: ctx.membro,
            corpo: corpo({ codigosResponsaveis: [colega.codigo] }),
        });
        expect(r.status).toBe(200);
        expect(r.corpo.responsaveis.map((x: any) => x.codigo)).toEqual([ctx.membro.codigo]);
    });

    it("membro não cria em projeto de que não participa", async () => {
        const r = await servidor.chamar("post", "/tarefas", { usuario: deFora, corpo: corpo() });
        expect(r.status).toBe(403);
    });

    it("membro só altera as próprias tarefas", async () => {
        const projeto = (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!;
        await criarTarefa(ctx.factory, colega, projeto);
        const status = await servidor.chamar("patch", "/tarefas/tarefa-teste/status", {
            usuario: ctx.membro,
            corpo: { status: "andamento" },
        });
        expect(status.status).toBe(403);
        expect(
            (await servidor.chamar("patch", "/tarefas/tarefa-teste/status", { usuario: colega, corpo: { status: "andamento" } })).status,
        ).toBe(200);
    });
});
