import Usuario from "../../source/domain/Entity/Usuario";
import Projeto from "../../source/domain/Entity/Projeto";
import Area from "../../source/domain/Entity/Area";
import PerfilUsuario from "../../source/domain/Enum/PerfilUsuario";
import { FRENTES_INICIATIVA, STATUS_INICIATIVA, TIPOS_INICIATIVA } from "../../source/domain/Enum/Iniciativa";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/**
 * Sessão 12b (03/11/2026): iniciativas de inovação. Todos veem; criam a gestão e a área de Inovação;
 * alteram o responsável, quem criou e a gestão. Ligadas a projetos, itens da Base e tarefas de Inovação.
 */
describe("Iniciativas de inovação", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let bruno: Usuario;
    let carla: Usuario;
    let diego: Usuario;

    const nova = (usuario: Usuario, corpo: Record<string, unknown>) =>
        servidor.chamar("post", "/iniciativas", { usuario, corpo: { tipo: "produto", frente: "lab", ...corpo } });
    const itemBase = async (titulo: string) =>
        (await servidor.chamar("post", "/conhecimento", { usuario: ctx.membro, corpo: { titulo, categoria: "pesquisa", resumo: "r" } }))
            .corpo;
    const tarefaInovacao = (corpo: Record<string, unknown>) =>
        servidor.chamar("post", "/tarefas", {
            usuario: ctx.gerente,
            corpo: {
                categoria: "inovacao",
                titulo: "Protótipo",
                dataInicio: "2026-11-03",
                dataFim: "2026-11-10",
                prioridade: "P2",
                codigosResponsaveis: ["usr-bruno"],
                ...corpo,
            },
        });
    const titulos = (corpo: any[]) => corpo.map((i) => i.titulo).sort();

    beforeEach(async () => {
        ctx = await criarContexto();
        const areas = ctx.factory.criarAreaRepository();
        await areas.criar(new Area("Inovação", null, true, "area-inov"));
        await areas.criar(new Area("Konvex Lab", "area-inov", true, "area-lab"));
        await areas.criar(new Area("Projetos", null, true, "area-proj"));
        const pessoa = (nome: string, codigo: string, area: Area | null) =>
            new Usuario(nome, `${codigo}@konvex.com.br`, PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, codigo, { area });
        bruno = pessoa("Bruno", "usr-bruno", null);
        carla = pessoa("Carla", "usr-carla", (await areas.buscarPorCodigo("area-inov"))!);
        diego = pessoa("Diego", "usr-diego", (await areas.buscarPorCodigo("area-lab"))!);
        for (const u of [bruno, carla, diego]) await ctx.factory.criarUsuarioRepository().criar(u);
        await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("App Delivery", "d", dataInicio, dataFim, undefined, [ctx.membro], "proj-app"));
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("devolve status, tipos e frentes com rótulo e se a pessoa pode criar", async () => {
        const r = await servidor.chamar("get", "/iniciativas/opcoes", { usuario: bruno });
        expect(r.status).toBe(200);
        expect(r.corpo.status).toEqual(STATUS_INICIATIVA);
        expect(r.corpo.status.map((s: any) => s.rotulo)).toEqual(["Ideia", "Em andamento", "Pausada", "Concluída", "Descartada"]);
        expect(r.corpo.tipos).toEqual(TIPOS_INICIATIVA);
        expect(r.corpo.frentes).toEqual(FRENTES_INICIATIVA);
        expect(r.corpo.podeCriar).toBe(false);
        const pode = async (u: Usuario) => (await servidor.chamar("get", "/iniciativas/opcoes", { usuario: u })).corpo.podeCriar;
        expect(await pode(ctx.gerente)).toBe(true);
        expect(await pode(carla)).toBe(true); // área Inovação
        expect(await pode(diego)).toBe(true); // subárea da Inovação
    });

    it("membro fora da Inovação não cria; gestão e área de Inovação criam", async () => {
        const negado = await nova(bruno, { titulo: "Ideia do Bruno" });
        expect(negado.status).toBe(403);
        expect(negado.corpo.message).toBe("Só a gestão e quem é da área de Inovação podem criar iniciativas.");

        const daCarla = await nova(carla, { titulo: "Chatbot de atendimento" });
        expect(daCarla.status).toBe(200);
        expect(daCarla.corpo.status).toBe("ideia");
        expect(daCarla.corpo.criadoPor).toEqual({ codigo: "usr-carla", nome: "Carla" });
        expect(daCarla.corpo.responsavel).toEqual({ codigo: "usr-carla", nome: "Carla" });
        expect(daCarla.corpo.podeAlterar).toBe(true);
        expect((await nova(ctx.gerente, { titulo: "Esteira de SaaS", codigoResponsavel: "usr-diego" })).corpo.responsavel.nome).toBe(
            "Diego",
        );
    });

    it("gestão liga a um projeto e a dois itens da Base, e tudo aparece na ficha e no item", async () => {
        const a = await itemBase("Pesquisa de chatbots");
        const b = await itemBase("Benchmark de LLMs");
        const criada = await nova(ctx.gerente, {
            titulo: "Chatbot",
            status: "andamento",
            frente: "radar",
            tipo: "servico",
            dataInicio: "2026-11-01",
            dataFim: "2026-12-15",
            descricao: "## Objetivo\nTestar",
            resultado: "Ainda em teste",
            aprendizados: "Começar pequeno",
            codigosProjetos: ["proj-app"],
            codigosConhecimentos: [a.codigo, b.codigo],
        });
        expect(criada.status).toBe(200);
        expect(criada.corpo.projetos).toEqual([{ codigo: "proj-app", nome: "App Delivery" }]);
        expect(criada.corpo.conhecimentos.map((c: any) => c.nome)).toEqual(["Benchmark de LLMs", "Pesquisa de chatbots"]);
        expect(criada.corpo.dataFim).toBe("2026-12-15T00:00:00.000Z");

        const ficha = await servidor.chamar("get", `/iniciativas/${criada.corpo.codigo}`, { usuario: bruno });
        expect(ficha.status).toBe(200);
        expect(ficha.corpo.podeAlterar).toBe(false);
        expect(ficha.corpo.conhecimentos).toHaveLength(2);

        const item = await servidor.chamar("get", `/conhecimento/${a.codigo}`, { usuario: bruno });
        expect(item.corpo.iniciativas).toEqual([{ codigo: criada.corpo.codigo, nome: "Chatbot" }]);
        const lista = await servidor.chamar("get", "/conhecimento", { usuario: bruno });
        expect(lista.corpo.find((i: any) => i.codigo === b.codigo).iniciativas).toHaveLength(1);
    });

    it("tarefa de Inovação ligada aparece na ficha para quem pode vê-la; outros veem só a contagem", async () => {
        const ini = (await nova(ctx.gerente, { titulo: "Chatbot" })).corpo;
        const t = await tarefaInovacao({ codigoIniciativa: ini.codigo });
        expect(t.status).toBe(200);
        expect(t.corpo.iniciativa).toEqual({ codigo: ini.codigo, nome: "Chatbot" });

        const gestao = (await servidor.chamar("get", `/iniciativas/${ini.codigo}`, { usuario: ctx.gerente })).corpo;
        expect(gestao.tarefas.map((x: any) => x.titulo)).toEqual(["Protótipo"]);
        expect(gestao.tarefas[0].responsaveis).toEqual([{ codigo: "usr-bruno", nome: "Bruno" }]);
        expect(gestao.totalTarefas).toBe(1);
        expect((await servidor.chamar("get", `/iniciativas/${ini.codigo}`, { usuario: bruno })).corpo.tarefas).toHaveLength(1);
        const outro = (await servidor.chamar("get", `/iniciativas/${ini.codigo}`, { usuario: carla })).corpo;
        expect(outro.tarefas).toEqual([]);
        expect(outro.totalTarefas).toBe(1);

        await servidor.chamar("patch", `/tarefas/${t.corpo.codigo}/status`, { usuario: bruno, corpo: { status: "concluida" } });
        expect((await servidor.chamar("get", `/iniciativas/${ini.codigo}`, { usuario: carla })).corpo.tarefasConcluidas).toBe(1);
    });

    it("só tarefa de Inovação aceita iniciativa; iniciativa inexistente dá 404; trocar de categoria desliga", async () => {
        const ini = (await nova(ctx.gerente, { titulo: "Chatbot" })).corpo;
        const errada = await tarefaInovacao({ categoria: "execucao", codigoIniciativa: ini.codigo });
        expect(errada.status).toBe(400);
        expect(errada.corpo.codigo).toBe("INICIATIVA_SO_EM_INOVACAO");
        expect((await tarefaInovacao({ codigoIniciativa: "nao-existe" })).status).toBe(404);

        const t = (await tarefaInovacao({ codigoIniciativa: ini.codigo })).corpo;
        const base = {
            titulo: "Protótipo",
            dataInicio: "2026-11-03",
            dataFim: "2026-11-10",
            status: "pendente",
            prioridade: "P2",
            codigosResponsaveis: ["usr-bruno"],
        };
        const mantida = await servidor.chamar("put", `/tarefas/${t.codigo}`, { usuario: ctx.gerente, corpo: base });
        expect(mantida.corpo.iniciativa?.codigo).toBe(ini.codigo);
        const trocada = await servidor.chamar("put", `/tarefas/${t.codigo}`, {
            usuario: ctx.gerente,
            corpo: { ...base, categoria: "execucao" },
        });
        expect(trocada.status).toBe(200);
        expect(trocada.corpo.iniciativa).toBeNull();
    });

    it("responsável e quem criou alteram; outro membro não; gestão altera qualquer uma", async () => {
        const ini = (await nova(carla, { titulo: "Chatbot", codigoResponsavel: "usr-diego" })).corpo;
        const corpo = { titulo: "Chatbot v2", tipo: "produto", frente: "lab", status: "pausada" };
        expect((await servidor.chamar("put", `/iniciativas/${ini.codigo}`, { usuario: diego, corpo })).status).toBe(200);
        expect((await servidor.chamar("put", `/iniciativas/${ini.codigo}`, { usuario: carla, corpo })).status).toBe(200);
        const negado = await servidor.chamar("put", `/iniciativas/${ini.codigo}`, { usuario: bruno, corpo });
        expect(negado.status).toBe(403);
        expect(negado.corpo.message).toMatch(/responsável, quem criou/);
        expect((await servidor.chamar("delete", `/iniciativas/${ini.codigo}`, { usuario: bruno })).status).toBe(403);
        const editada = await servidor.chamar("put", `/iniciativas/${ini.codigo}`, {
            usuario: ctx.gerente,
            corpo: { ...corpo, status: "concluida" },
        });
        expect(editada.corpo.status).toBe("concluida");
        // Sem codigoResponsavel no corpo, o responsável continua o mesmo.
        expect(editada.corpo.responsavel.codigo).toBe("usr-diego");
    });

    it("valida campos com mensagens que dizem o que está errado", async () => {
        const semTitulo = await nova(ctx.gerente, { titulo: " " });
        expect(semTitulo.status).toBe(400);
        expect(semTitulo.corpo.message).toBe("O título da iniciativa é obrigatório.");
        const tipo = await nova(ctx.gerente, { titulo: "X", tipo: "foguete" });
        expect(tipo.corpo.codigo).toBe("TIPO_INICIATIVA_INVALIDO");
        expect(tipo.corpo.message).toMatch(/produto, projeto/);
        expect((await nova(ctx.gerente, { titulo: "X", frente: "y" })).corpo.codigo).toBe("FRENTE_INICIATIVA_INVALIDA");
        expect((await nova(ctx.gerente, { titulo: "X", status: "y" })).corpo.codigo).toBe("STATUS_INICIATIVA_INVALIDO");
        const datas = await nova(ctx.gerente, { titulo: "X", dataInicio: "2026-12-10", dataFim: "2026-12-01" });
        expect(datas.status).toBe(400);
        expect(datas.corpo.codigo).toBe("PERIODO_INICIATIVA_INVALIDO");
        expect((await nova(ctx.gerente, { titulo: "X", codigosProjetos: ["nao-existe"] })).status).toBe(404);
        expect((await nova(ctx.gerente, { titulo: "X", codigoResponsavel: "nao-existe" })).status).toBe(404);
        expect((await servidor.chamar("get", "/iniciativas/nao-existe", { usuario: bruno })).status).toBe(404);
    });

    it("filtra por busca, status, frente, tipo, responsável e projeto", async () => {
        await nova(ctx.gerente, {
            titulo: "Chatbot",
            descricao: "Atendimento com IA",
            status: "andamento",
            frente: "radar",
            codigosProjetos: ["proj-app"],
        });
        await nova(carla, { titulo: "Esteira SaaS", tipo: "processo" });
        const q = async (query: string) => titulos((await servidor.chamar("get", `/iniciativas?${query}`, { usuario: bruno })).corpo);
        expect(await q("")).toEqual(["Chatbot", "Esteira SaaS"]);
        expect(await q("busca=ia")).toEqual(["Chatbot"]);
        expect(await q("status=andamento")).toEqual(["Chatbot"]);
        expect(await q("frente=lab")).toEqual(["Esteira SaaS"]);
        expect(await q("tipo=processo")).toEqual(["Esteira SaaS"]);
        expect(await q("codigoResponsavel=usr-carla")).toEqual(["Esteira SaaS"]);
        expect(await q("codigoProjeto=proj-app")).toEqual(["Chatbot"]);
    });

    it("excluir mantém as tarefas e o item da Base, só sem a ligação", async () => {
        const item = await itemBase("Pesquisa");
        const ini = (await nova(ctx.gerente, { titulo: "Chatbot", codigosConhecimentos: [item.codigo] })).corpo;
        const t = (await tarefaInovacao({ codigoIniciativa: ini.codigo })).corpo;
        const r = await servidor.chamar("delete", `/iniciativas/${ini.codigo}`, { usuario: ctx.gerente });
        expect(r.status).toBe(200);
        expect((await servidor.chamar("get", `/tarefas/${t.codigo}/comentarios`, { usuario: ctx.gerente })).status).toBe(200);
        const tarefas = (await servidor.chamar("get", "/tarefas?categoria=inovacao", { usuario: ctx.gerente })).corpo;
        expect(tarefas[0].iniciativa).toBeNull();
        expect((await servidor.chamar("get", `/conhecimento/${item.codigo}`, { usuario: bruno })).corpo.iniciativas).toEqual([]);
    });
});
