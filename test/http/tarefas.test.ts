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

    it("filtros do painel: responsável, status e projeto; membro vê só o projeto dele", async () => {
        const doColega = await servidor.chamar("post", "/tarefas", {
            usuario: ctx.gerente,
            corpo: corpo({ titulo: "Do colega", codigosResponsaveis: [colega.codigo] }),
        });
        const daAna = await servidor.chamar("post", "/tarefas", {
            usuario: ctx.gerente,
            corpo: corpo({ titulo: "Da Ana", codigosResponsaveis: [ctx.membro.codigo] }),
        });
        const outroProjeto = await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("Outro", "d", dataInicio, dataFim, undefined, [deFora], "proj-outro"));
        const alheia = await criarTarefa(ctx.factory, deFora, outroProjeto, "tarefa-alheia");
        const ids = async (q: string, usuario = ctx.gerente) =>
            (await servidor.chamar("get", `/tarefas${q}`, { usuario })).corpo.map((x: any) => x.codigo).sort();
        expect(await ids("")).toEqual([doColega.corpo.codigo, daAna.corpo.codigo, alheia.codigo].sort());
        expect(await ids(`?codigoResponsavel=${colega.codigo}`)).toEqual([doColega.corpo.codigo]);
        expect(await ids("?status=concluida")).toEqual([]);
        expect(await ids("?codigoProjeto=proj-outro")).toEqual([alheia.codigo]);
        // Membro: as tarefas do projeto de que participa; nunca as do projeto do colega de fora.
        expect(await ids("", ctx.membro)).toEqual([doColega.corpo.codigo, daAna.corpo.codigo].sort());
        expect(await ids("", deFora)).toEqual([alheia.codigo]);
    });

    it("sessão 17: iniciativa saiu; o campo no corpo é ignorado no POST e no PUT", async () => {
        const criada = await servidor.chamar("post", "/tarefas", {
            usuario: ctx.gerente,
            corpo: corpo({ codigoIniciativa: "ini-x", iniciativa: { codigo: "ini-x" } }),
        });
        expect(criada.status).toBe(200);
        expect(criada.corpo).not.toHaveProperty("iniciativa");
        const editada = await servidor.chamar("put", `/tarefas/${criada.corpo.codigo}`, {
            usuario: ctx.gerente,
            corpo: { ...corpo(), status: "pendente", codigoIniciativa: "ini-y" },
        });
        expect(editada.status).toBe(200);
        expect(editada.corpo).not.toHaveProperty("iniciativa");
    });

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

        it("GET /tarefas traz a coluna e não repete projeto.colunas", async () => {
            const lista = (await servidor.chamar("get", "/tarefas", { usuario: ctx.gerente })).corpo;
            const deProjeto = lista.find((t: any) => t.codigo === "tarefa-teste");
            expect(deProjeto.coluna).toMatchObject({ nome: "A fazer", cor: "cinza" });
            expect(deProjeto.projeto.colunas).toBeUndefined();
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
    describe("sessão 24b: quem criou edita e exclui a própria tarefa", () => {
        const criarPor = async (usuario: Usuario, extra: object = {}) =>
            (await servidor.chamar("post", "/tarefas", { usuario, corpo: corpo({ prioridade: "P3", ...extra }) })).corpo;
        const editar = (usuario: Usuario, tarefa: any, extra: object = {}) =>
            servidor.chamar("put", `/tarefas/${tarefa.codigo}`, {
                usuario,
                corpo: {
                    titulo: tarefa.titulo,
                    dataInicio: "2026-10-12T12:00:00.000Z",
                    dataFim: "2026-10-16T12:00:00.000Z",
                    status: tarefa.status,
                    prioridade: tarefa.prioridade,
                    ...extra,
                },
            });

        it("criador muda a prioridade", async () => {
            const t = await criarPor(colega);
            const r = await editar(colega, t, { prioridade: "P1", codigosResponsaveis: [colega.codigo] });
            expect(r.status).toBe(200);
            expect(r.corpo.prioridade).toBe("P1");
        });

        it("criador não troca os responsáveis: a lista enviada é ignorada", async () => {
            const t = await criarPor(colega);
            const r = await editar(colega, t, { codigosResponsaveis: [ctx.membro.codigo] });
            expect(r.status).toBe(200);
            expect(r.corpo.responsaveis.map((x: any) => x.codigo)).toEqual([colega.codigo]);
        });

        it("criador que não é responsável não conclui pelo PUT", async () => {
            const t = await criarPor(colega);
            // A gestão passa a tarefa para outra pessoa; o criador deixa de ser responsável.
            await editar(ctx.gerente, t, { codigosResponsaveis: [ctx.membro.codigo] });
            const r = await editar(colega, t, { status: "concluida", prioridade: "P1" });
            expect(r.status).toBe(200);
            expect(r.corpo.prioridade).toBe("P1");
            expect(r.corpo.status).toBe(t.status);
        });

        it("criador exclui a própria tarefa; outro participante não exclui a alheia", async () => {
            const t = await criarPor(colega);
            expect((await servidor.chamar("delete", `/tarefas/${t.codigo}`, { usuario: ctx.membro })).status).toBe(403);
            expect((await servidor.chamar("delete", `/tarefas/${t.codigo}`, { usuario: colega })).status).toBe(200);
        });

        it("criador que saiu da equipe: PUT 403", async () => {
            const t = await criarPor(colega);
            const projeto = (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!;
            const part = projeto.participacaoAtivaDe(colega.codigo)!;
            await servidor.chamar("post", `/projetos/proj-time/membros/${part.codigo}/encerrar`, { usuario: ctx.gerente, corpo: {} });
            expect((await editar(colega, t, { prioridade: "P1" })).status).toBe(403);
        });
    });
});
