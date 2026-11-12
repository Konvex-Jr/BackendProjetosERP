import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto, criarTarefa, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 8c: tarefas avulsas (sem projeto, com categoria) e filtros do painel global. */
describe("Tarefas avulsas pela API", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let diretor: Usuario;
    let assessor: Usuario;
    let outro: Usuario;
    const avulsa = (extra: object = {}) => ({
        categoria: "inovacao",
        titulo: "Pesquisar ferramentas de IA",
        dataInicio: "2026-11-02T12:00:00.000Z",
        dataFim: "2026-11-06T12:00:00.000Z",
        prioridade: "P2",
        ...extra,
    });

    beforeEach(async () => {
        ctx = await criarContexto();
        assessor = ctx.membro;
        diretor = new Usuario("Diana", "diana@konvex.com.br", PerfilUsuario.DIRETOR, true, "x", ctx.senioridade, "usr-diana");
        outro = new Usuario("Otávio", "otavio@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-otavio");
        await ctx.factory.criarUsuarioRepository().criar(diretor);
        await ctx.factory.criarUsuarioRepository().criar(outro);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const criarAvulsa = async (extra: object = {}) => {
        const r = await servidor.chamar("post", "/tarefas", {
            usuario: diretor,
            corpo: avulsa({ codigosResponsaveis: [assessor.codigo], ...extra }),
        });
        expect(r.status).toBe(200);
        return r.corpo;
    };

    it("diretor cria avulsa para qualquer pessoa ativa; fica registrado quem criou", async () => {
        const t = await criarAvulsa();
        expect(t.projeto).toBeNull();
        expect(t.avulsa).toBe(true);
        expect(t.categoria).toBe("inovacao");
        expect(t.criadaPor.codigo).toBe(diretor.codigo);
        expect(t.responsaveis.map((r: any) => r.codigo)).toEqual([assessor.codigo]);
    });

    it("valida: projeto OU categoria, e só categorias conhecidas", async () => {
        const nenhum = await servidor.chamar("post", "/tarefas", { usuario: diretor, corpo: avulsa({ categoria: undefined }) });
        expect(nenhum.status).toBe(400);
        const invalida = await servidor.chamar("post", "/tarefas", { usuario: diretor, corpo: avulsa({ categoria: "marketing" }) });
        expect(invalida.status).toBe(400);
        await ctx.factory.criarProjetoRepository().criar(new Projeto("P", "d", dataInicio, dataFim, undefined, [assessor], "proj-p"));
        const ambos = await servidor.chamar("post", "/tarefas", { usuario: diretor, corpo: avulsa({ codigoProjeto: "proj-p" }) });
        expect(ambos.status).toBe(400);
        expect((await servidor.chamar("get", "/tarefas?categoria=marketing", { usuario: diretor })).status).toBe(400);
    });

    it("membro não cria avulsa", async () => {
        const r = await servidor.chamar("post", "/tarefas", {
            usuario: assessor,
            corpo: avulsa({ codigosResponsaveis: [assessor.codigo] }),
        });
        expect(r.status).toBe(403);
    });

    it("responsável vê, conclui, reabre e comenta; não edita nem exclui", async () => {
        const t = await criarAvulsa();
        const minhas = await servidor.chamar("get", "/tarefas?minhas=true", { usuario: assessor });
        expect(minhas.corpo.map((x: any) => x.codigo)).toEqual([t.codigo]);
        const concluida = await servidor.chamar("patch", `/tarefas/${t.codigo}/status`, {
            usuario: assessor,
            corpo: { status: "concluida" },
        });
        expect(concluida.status).toBe(200);
        expect(concluida.corpo.concluidaPor.codigo).toBe(assessor.codigo);
        expect(concluida.corpo.categoria).toBe("inovacao");
        expect(
            (await servidor.chamar("patch", `/tarefas/${t.codigo}/status`, { usuario: assessor, corpo: { status: "pendente" } })).status,
        ).toBe(200);
        const c = await servidor.chamar("post", `/tarefas/${t.codigo}/comentarios`, { usuario: assessor, corpo: { texto: "Comecei" } });
        expect(c.status).toBe(200);
        expect((await servidor.chamar("get", `/tarefas/${t.codigo}/comentarios`, { usuario: diretor })).corpo).toHaveLength(1);
        expect(
            (await servidor.chamar("put", `/tarefas/${t.codigo}`, { usuario: assessor, corpo: { ...avulsa(), status: "pendente" } }))
                .status,
        ).toBe(403);
        expect((await servidor.chamar("delete", `/tarefas/${t.codigo}`, { usuario: assessor })).status).toBe(403);
    });

    it("outro membro não vê nem mexe na avulsa alheia", async () => {
        const t = await criarAvulsa();
        expect((await servidor.chamar("get", "/tarefas", { usuario: outro })).corpo).toEqual([]);
        expect(
            (await servidor.chamar("patch", `/tarefas/${t.codigo}/status`, { usuario: outro, corpo: { status: "concluida" } })).status,
        ).toBe(404);
        expect((await servidor.chamar("get", `/tarefas/${t.codigo}/comentarios`, { usuario: outro })).status).toBe(404);
        expect((await servidor.chamar("post", `/tarefas/${t.codigo}/comentarios`, { usuario: outro, corpo: { texto: "oi" } })).status).toBe(
            404,
        );
    });

    it("gestão edita (troca categoria e responsável) e exclui; gerente também organiza", async () => {
        const t = await criarAvulsa();
        const editada = await servidor.chamar("put", `/tarefas/${t.codigo}`, {
            usuario: ctx.gerente,
            corpo: { ...avulsa(), categoria: "execucao", status: "andamento", codigosResponsaveis: [outro.codigo] },
        });
        expect(editada.status).toBe(200);
        expect(editada.corpo.categoria).toBe("execucao");
        expect(editada.corpo.criadaPor.codigo).toBe(diretor.codigo);
        expect(editada.corpo.responsaveis.map((r: any) => r.codigo)).toEqual([outro.codigo]);
        // O antigo responsável deixa de ver.
        expect((await servidor.chamar("get", "/tarefas", { usuario: assessor })).corpo).toEqual([]);
        expect((await servidor.chamar("delete", `/tarefas/${t.codigo}`, { usuario: ctx.gerente })).status).toBeLessThan(300);
    });

    it("filtros do painel: categoria, avulsas, responsável e status; projeto continua igual", async () => {
        const projeto = await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("P", "d", dataInicio, dataFim, undefined, [assessor], "proj-p"));
        await criarTarefa(ctx.factory, assessor, projeto);
        const a = await criarAvulsa();
        await criarAvulsa({ categoria: "capacitacao", codigosResponsaveis: [outro.codigo] });
        const ids = async (q: string, usuario = diretor) =>
            (await servidor.chamar("get", `/tarefas${q}`, { usuario })).corpo.map((x: any) => x.codigo).sort();
        expect(await ids("")).toHaveLength(3);
        expect(await ids("?categoria=inovacao")).toEqual([a.codigo]);
        expect(await ids("?categoria=avulsas")).toHaveLength(2);
        expect(await ids(`?codigoResponsavel=${assessor.codigo}`)).toEqual([a.codigo, "tarefa-teste"].sort());
        expect(await ids("?status=concluida")).toEqual([]);
        expect(await ids("?codigoProjeto=proj-p")).toEqual(["tarefa-teste"]);
        // Membro: as do projeto dele + a avulsa em que é responsável; nunca a do colega.
        expect(await ids("", assessor)).toEqual([a.codigo, "tarefa-teste"].sort());
    });
});
