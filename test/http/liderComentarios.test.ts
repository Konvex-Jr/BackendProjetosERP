import Usuario from "../../source/domain/Entity/Usuario";
import Projeto from "../../source/domain/Entity/Projeto";
import PerfilUsuario from "../../source/domain/Enum/PerfilUsuario";
import { criarContexto, criarTarefa, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 8b: líder do projeto, papéis nas tarefas e comentários. */
describe("Líder e comentários pela API", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let lider: Usuario;
    let colega: Usuario;
    let deFora: Usuario;
    const corpoTarefa = (extra: object = {}) => ({
        codigoProjeto: "proj-time",
        titulo: "Levantar requisitos",
        dataInicio: "2026-10-12T12:00:00.000Z",
        dataFim: "2026-10-16T12:00:00.000Z",
        prioridade: "P2",
        ...extra,
    });

    beforeEach(async () => {
        ctx = await criarContexto();
        lider = ctx.membro;
        colega = new Usuario("Bruno", "bruno@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-bruno");
        deFora = new Usuario("Carla", "carla@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-carla");
        await ctx.factory.criarUsuarioRepository().criar(colega);
        await ctx.factory.criarUsuarioRepository().criar(deFora);
        await ctx.factory.criarProjetoRepository().criar(
            new Projeto("Time", "d", dataInicio, dataFim, undefined, [lider, colega], "proj-time"));
        servidor = await subirServidor(ctx.factory);
        const r = await servidor.chamar("put", "/projetos/proj-time/lider", { usuario: ctx.gerente, corpo: { codigoUsuario: lider.codigo } });
        expect(r.status).toBe(200);
        expect(r.corpo.lider.codigo).toBe(lider.codigo);
    });

    afterEach(async () => servidor.fechar());

    const tarefaDoColega = async () => {
        const projeto = (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!;
        await criarTarefa(ctx.factory, colega, projeto);
        return "tarefa-teste";
    };

    it("só a gestão define o líder, e ele precisa estar na equipe atual", async () => {
        expect((await servidor.chamar("put", "/projetos/proj-time/lider", { usuario: lider, corpo: { codigoUsuario: colega.codigo } })).status).toBe(403);
        const fora = await servidor.chamar("put", "/projetos/proj-time/lider", { usuario: ctx.gerente, corpo: { codigoUsuario: deFora.codigo } });
        expect(fora.status).toBe(400);
        const sem = await servidor.chamar("put", "/projetos/proj-time/lider", { usuario: ctx.gerente, corpo: { codigoUsuario: null } });
        expect(sem.corpo.lider).toBeNull();
    });

    it("líder deixa de ser líder ao sair da equipe", async () => {
        const projeto = (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!;
        const part = projeto.participacaoAtivaDe(lider.codigo)!;
        await servidor.chamar("post", `/projetos/proj-time/membros/${part.codigo}/encerrar`, { usuario: ctx.gerente, corpo: {} });
        expect((await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!.lider).toBeNull();
    });

    it("líder cria com qualquer responsável, edita, conclui e exclui tarefas de outros", async () => {
        const criada = await servidor.chamar("post", "/tarefas", { usuario: lider, corpo: corpoTarefa({ codigosResponsaveis: [colega.codigo] }) });
        expect(criada.status).toBe(200);
        expect(criada.corpo.responsaveis.map((r: any) => r.codigo)).toEqual([colega.codigo]);
        const codigo = await tarefaDoColega();
        const editada = await servidor.chamar("put", `/tarefas/${codigo}`, {
            usuario: lider, corpo: { ...corpoTarefa(), titulo: "Novo", status: "pendente", codigosResponsaveis: [lider.codigo] } });
        expect(editada.status).toBe(200);
        const concluida = await servidor.chamar("patch", `/tarefas/${codigo}/status`, { usuario: lider, corpo: { status: "concluida" } });
        expect(concluida.status).toBe(200);
        expect(concluida.corpo.concluidaPor.codigo).toBe(lider.codigo);
        expect(concluida.corpo.dataConclusao).toBeTruthy();
        expect((await servidor.chamar("delete", `/tarefas/${codigo}`, { usuario: lider })).status).toBeLessThan(300);
    });

    it("participante cria (vira responsável), conclui/reabre as suas, mas não edita nem exclui", async () => {
        const criada = await servidor.chamar("post", "/tarefas", { usuario: colega, corpo: corpoTarefa({ codigosResponsaveis: [lider.codigo] }) });
        expect(criada.corpo.responsaveis.map((r: any) => r.codigo)).toEqual([colega.codigo]);
        const codigo = await tarefaDoColega();
        const concluida = await servidor.chamar("patch", `/tarefas/${codigo}/status`, { usuario: colega, corpo: { status: "concluida" } });
        expect(concluida.corpo.concluidaPor.codigo).toBe(colega.codigo);
        const reaberta = await servidor.chamar("patch", `/tarefas/${codigo}/status`, { usuario: colega, corpo: { status: "pendente" } });
        expect(reaberta.corpo.concluidaPor).toBeNull();
        expect(reaberta.corpo.dataConclusao).toBeNull();
        expect((await servidor.chamar("put", `/tarefas/${codigo}`, { usuario: colega, corpo: { ...corpoTarefa(), status: "pendente" } })).status).toBe(403);
        expect((await servidor.chamar("delete", `/tarefas/${codigo}`, { usuario: colega })).status).toBe(403);
    });

    it("participante não conclui tarefa de outro; quem está fora não faz nada", async () => {
        const codigo = await tarefaDoColega();
        const projeto = (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!;
        // tira o líder para o membro virar participante comum
        await servidor.chamar("put", "/projetos/proj-time/lider", { usuario: ctx.gerente, corpo: { codigoUsuario: null } });
        expect(projeto).toBeTruthy();
        expect((await servidor.chamar("patch", `/tarefas/${codigo}/status`, { usuario: lider, corpo: { status: "concluida" } })).status).toBe(403);
        expect((await servidor.chamar("post", "/tarefas", { usuario: deFora, corpo: corpoTarefa() })).status).toBe(403);
        expect((await servidor.chamar("post", `/tarefas/${codigo}/comentarios`, { usuario: deFora, corpo: { texto: "oi" } })).status).toBe(403);
        expect((await servidor.chamar("get", `/tarefas/${codigo}/comentarios`, { usuario: deFora })).status).toBe(403);
    });

    it("comentários: equipe comenta; cada um apaga o seu; líder e gestão apagam qualquer um", async () => {
        const codigo = await tarefaDoColega();
        const c1 = await servidor.chamar("post", `/tarefas/${codigo}/comentarios`, { usuario: colega, corpo: { texto: "Comecei hoje" } });
        expect(c1.status).toBe(200);
        expect(c1.corpo.autor.codigo).toBe(colega.codigo);
        expect(c1.corpo.autor.email).toBeUndefined();
        const c2 = await servidor.chamar("post", `/tarefas/${codigo}/comentarios`, { usuario: lider, corpo: { texto: "Boa" } });
        expect((await servidor.chamar("post", `/tarefas/${codigo}/comentarios`, { usuario: lider, corpo: { texto: "  " } })).status).toBe(400);

        const lista = await servidor.chamar("get", `/tarefas/${codigo}/comentarios`, { usuario: colega });
        expect(lista.corpo.map((c: any) => c.texto)).toEqual(["Comecei hoje", "Boa"]);

        expect((await servidor.chamar("delete", `/tarefas/${codigo}/comentarios/${c2.corpo.codigo}`, { usuario: colega })).status).toBe(403);
        expect((await servidor.chamar("delete", `/tarefas/${codigo}/comentarios/${c1.corpo.codigo}`, { usuario: lider })).status).toBeLessThan(300);
        expect((await servidor.chamar("delete", `/tarefas/${codigo}/comentarios/${c2.corpo.codigo}`, { usuario: ctx.gerente })).status).toBeLessThan(300);
        expect((await servidor.chamar("get", `/tarefas/${codigo}/comentarios`, { usuario: ctx.gerente })).corpo).toEqual([]);
    });
});
