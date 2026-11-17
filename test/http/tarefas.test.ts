import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
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

    describe("colunas do quadro", () => {
        const coluna = async (nome: string) =>
            (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!.colunas.find((c) => c.nome === nome)!;
        const mover = (usuario: Usuario, codigo: string, codigoColuna: unknown) =>
            servidor.chamar("patch", `/tarefas/${codigo}/coluna`, { usuario, corpo: { codigoColuna } });
        let projeto: Projeto;

        beforeEach(async () => {
            projeto = (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!;
            await criarTarefa(ctx.factory, colega, projeto);
        });

        it("responsável move a própria tarefa; participante que não é responsável, 403", async () => {
            const revisando = await coluna("Revisando");
            const feita = await mover(colega, "tarefa-teste", revisando.codigo);
            expect(feita.status).toBe(200);
            expect(feita.corpo.coluna).toMatchObject({ nome: "Revisando", cor: "amarelo" });
            expect(feita.corpo.status).toBe("andamento");
            const negado = await mover(ctx.membro, "tarefa-teste", revisando.codigo);
            expect(negado.status).toBe(403);
            expect(negado.corpo.message).toBe("Só o responsável pela tarefa, o líder do projeto e a gestão podem mover a tarefa.");
        });

        it("líder e gestão movem tarefa de outro", async () => {
            await servidor.chamar("put", "/projetos/proj-time/lider", {
                usuario: ctx.gerente,
                corpo: { codigoUsuario: ctx.membro.codigo },
            });
            const concluido = await coluna("Concluído");
            const r = await mover(ctx.membro, "tarefa-teste", concluido.codigo);
            expect(r.status).toBe(200);
            expect(r.corpo.status).toBe("concluida");
            expect(r.corpo.concluidaPor.codigo).toBe(ctx.membro.codigo);
        });

        it("coluna inexistente ou ausente: 400 COLUNA_DE_OUTRO_PROJETO", async () => {
            const r = await mover(colega, "tarefa-teste", "excluida");
            expect(r.status).toBe(400);
            expect(r.corpo.codigo).toBe("COLUNA_DE_OUTRO_PROJETO");
            expect((await mover(colega, "tarefa-teste", undefined)).status).toBe(400);
        });

        it("GET /tarefas traz coluna na de projeto, null na avulsa, e não repete projeto.colunas", async () => {
            const avulsa = await servidor.chamar("post", "/tarefas", {
                usuario: ctx.gerente,
                corpo: {
                    categoria: "inovacao",
                    titulo: "Avulsa",
                    dataInicio: "2026-10-12T12:00:00.000Z",
                    dataFim: "2026-10-16T12:00:00.000Z",
                },
            });
            expect(avulsa.status).toBe(200);
            const lista = (await servidor.chamar("get", "/tarefas", { usuario: ctx.gerente })).corpo;
            const deProjeto = lista.find((t: any) => t.codigo === "tarefa-teste");
            expect(deProjeto.coluna).toMatchObject({ nome: "A fazer", cor: "cinza" });
            expect(deProjeto.projeto.colunas).toBeUndefined();
            expect(lista.find((t: any) => t.codigo === avulsa.corpo.codigo).coluna).toBeNull();
        });

        it("tarefa de sigiloso sem acesso: 404 no PATCH /coluna", async () => {
            const sig = await ctx.factory
                .criarProjetoRepository()
                .criar(new Projeto("Sigiloso", "d", dataInicio, dataFim, undefined, [ctx.membro], "proj-sig", { sigiloso: true }));
            await criarTarefa(ctx.factory, ctx.membro, sig, "tarefa-sig");
            const r = await mover(deFora, "tarefa-sig", sig.colunas[1].codigo);
            expect(r.status).toBe(404);
        });
    });
});
