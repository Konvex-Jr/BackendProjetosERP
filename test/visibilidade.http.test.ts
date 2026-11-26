import Area from "../source/domain/entity/Area";
import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import Usuario from "../source/domain/entity/Usuario";
import DificuldadeTarefa from "../source/domain/enum/DificuldadeTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import TipoProjeto from "../source/domain/enum/TipoProjeto";
import { hoje } from "../source/shared/datas";
import { criarContexto } from "./fixtures";
import { subirServidor } from "./http/servidorTeste";
import { Papel, comPapel } from "./papel";

const UM_DIA = 86_400_000;
const CHAVES_DO_CARTAO = ["area", "cartao", "codigo", "geralDaArea", "lider", "membros", "nome", "status", "tipo"];

/**
 * Sessão 27a: todo logado recebe o cartão de todos os projetos; o completo é da equipe e da gestão
 * (no sigiloso, da equipe atual e dos diretores). A lista de acesso saiu.
 */
describe("Visibilidade de projetos (HTTP)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let m: Usuario; // membro fora de N e de S
    let m2: Usuario; // membro na equipe de N2 e de S
    let t: Usuario; // trainee fora de tudo
    let g: Usuario; // gerente fora de tudo
    let d: Usuario; // diretor fora de tudo
    let gs: Usuario; // gerente na equipe de S
    const dia = hoje();
    const inicio = new Date(dia.getTime() - 30 * UM_DIA);
    const fim = new Date(dia.getTime() + 60 * UM_DIA);
    const iso = (x: Date) => x.toISOString().slice(0, 10);

    const tarefa = (projeto: Projeto, codigo: string, responsavel: Usuario) =>
        new Tarefa(
            projeto,
            `Tarefa ${codigo}`,
            dia,
            dia,
            StatusTarefa.PENDENTE,
            PrioridadeTarefa.P2,
            null,
            null,
            null,
            [responsavel],
            [],
            codigo,
            null,
            null,
            null,
            DificuldadeTarefa.MEDIA,
        );

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const novo = async (nome: string, perfil: Papel, codigo: string, status = StatusPessoa.ATIVO) => {
            const u = comPapel(new Usuario(nome, `${codigo}@konvex.com.br`, true, "x", ctx.senioridade, codigo, { status }), perfil);
            await usuarios.criar(u);
            return u;
        };
        m = await novo("Mel Membro", "membro", "usr-m");
        m2 = await novo("Mio Membro", "membro", "usr-m2");
        t = await novo("Téo Trainee", "membro", "usr-t", StatusPessoa.TRAINEE);
        // Gerente de outra área (31a): só abre os projetos da área do cargo, que nenhum projeto daqui tem.
        g = await novo("Gil Gerente", "gerenteDaArea", "usr-g");
        d = await novo("Dora Diretora", "diretor", "usr-d");
        gs = await novo("Gus Gerente", "gerenteDaArea", "usr-gs");

        const area = await ctx.factory.criarAreaRepository().criar(new Area("Marketing", null, true, "area-mkt", false));
        const projetos = ctx.factory.criarProjetoRepository();
        const n = await projetos.criar(
            new Projeto("Normal Alfa", "descrição sem pista zebra", inicio, fim, undefined, [m2], "p-n", {
                clienteNome: "Cliente X",
                referencia: "REF-1",
                lider: m2,
            }),
        );
        const s = await projetos.criar(new Projeto("Sigiloso Beta", "d", inicio, fim, undefined, [m2, gs], "p-s", { criadoPor: g.codigo }));
        await projetos.criar(new Projeto("Interno Gama", "d", inicio, fim, undefined, [m2], "p-i", { tipo: TipoProjeto.INTERNO, area }));
        const tarefas = ctx.factory.criarTarefaRepository();
        await tarefas.criar(tarefa(n, "t-n", m2));
        await tarefas.criar(tarefa(s, "t-s", m2));
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const lista = async (usuario: Usuario, query = "") => {
        const r = await servidor.chamar("get", `/projetos${query}`, { usuario });
        expect(r.status).toBe(200);
        return new Map<string, any>(r.corpo.map((p: any) => [p.codigo, p]));
    };

    describe("GET /projetos", () => {
        it.each([
            ["membro", () => m],
            ["trainee", () => t],
        ])("%s recebe todos os projetos alheios como cartão, só com os campos da lista fechada", async (_nome, quem) => {
            const projetos = await lista(quem());
            expect([...projetos.keys()].sort()).toEqual(["p-i", "p-n", "p-s"]);
            for (const p of projetos.values()) {
                expect(Object.keys(p).sort()).toEqual(CHAVES_DO_CARTAO);
                expect(p.cartao).toBe(true);
            }
            expect(projetos.get("p-n")).toEqual({
                codigo: "p-n",
                nome: "Normal Alfa",
                tipo: "cliente",
                area: null,
                status: projetos.get("p-n").status,
                lider: { codigo: m2.codigo, nome: m2.nome },
                geralDaArea: false,
                membros: projetos.get("p-n").membros,
                cartao: true,
            });
            // Equipe atual com nome e foto, sem função (sessão 27b).
            for (const membro of projetos.get("p-n").membros) expect(Object.keys(membro).sort()).toEqual(["codigo", "foto", "nome"]);
            expect(projetos.get("p-n").membros.map((x: any) => x.codigo)).toContain(m2.codigo);
            expect(projetos.get("p-i").area).toEqual({ codigo: "area-mkt", nome: "Marketing" });
            const texto = JSON.stringify([...projetos.values()]);
            for (const proibido of [
                "dataInicio",
                "dataFim",
                "tarefas",
                "participacoes",
                "Cliente X",
                "REF-1",
                "zebra",
                "podeGerirAcesso",
            ]) {
                expect(texto).not.toContain(proibido);
            }
        });

        it("gerente de outra área: tudo cartão, inclusive o que criou sem estar na equipe (31a)", async () => {
            const projetos = await lista(g);
            for (const p of projetos.values()) expect(Object.keys(p).sort()).toEqual(CHAVES_DO_CARTAO);
        });

        it("gerente na equipe: completo no projeto dele, cartão nos outros", async () => {
            const projetos = await lista(gs);
            expect(projetos.get("p-s").cartao).toBeUndefined();
            expect(projetos.get("p-s")).not.toHaveProperty("acesso");
            expect(projetos.get("p-n").cartao).toBe(true);
        });

        it("diretor: tudo completo", async () => {
            const projetos = await lista(d);
            expect(projetos.size).toBe(3);
            for (const p of projetos.values()) expect(p.cartao).toBeUndefined();
            expect(projetos.get("p-s").tarefas).toMatchObject({ total: 1 });
        });

        it("filtro de pessoa descarta os cartões (não revela a equipe)", async () => {
            const doM2 = await lista(d, `?codigoUsuario=${m2.codigo}`);
            expect([...doM2.keys()].sort()).toEqual(["p-i", "p-n", "p-s"]);
            for (const p of doM2.values()) expect(p.cartao).toBeUndefined();
            // Membro pedindo os de outra pessoa: só os que vê completo (nenhum aqui).
            expect((await lista(m, `?codigoUsuario=${m2.codigo}`)).size).toBe(0);
        });

        it("filtro de área mantém o cartão do interno, não o do cliente (a área do cliente não está no cartão)", async () => {
            const area = (await ctx.factory.criarAreaRepository().buscarPorCodigo("area-mkt"))!;
            await ctx.factory
                .criarProjetoRepository()
                .criar(new Projeto("Cliente com área", "d", inicio, fim, undefined, [m2], "p-ca", { area }));
            const projetos = await lista(m, "?codigoArea=area-mkt");
            expect([...projetos.keys()]).toEqual(["p-i"]);
            expect(projetos.get("p-i").cartao).toBe(true);
            expect([...(await lista(d, "?codigoArea=area-mkt")).keys()].sort()).toEqual(["p-ca", "p-i"]);
        });

        it("busca no cartão só pelo nome (cliente e referência não servem de pista)", async () => {
            expect((await lista(m, "?busca=cliente%20x")).has("p-n")).toBe(false);
            expect((await lista(m, "?busca=REF-1")).has("p-n")).toBe(false);
            expect((await lista(m, "?busca=alfa")).has("p-n")).toBe(true);
            // Quem vê completo continua achando pelo cliente.
            expect((await lista(d, "?busca=cliente%20x")).has("p-n")).toBe(true);
        });
    });

    describe("GET /projetos/:codigo e escrita", () => {
        it("membro de fora: 200 com o cartão; colunas 403 PROJETO_SEM_ACESSO", async () => {
            const r = await servidor.chamar("get", "/projetos/p-n", { usuario: m });
            expect(r.status).toBe(200);
            expect(Object.keys(r.corpo).sort()).toEqual(CHAVES_DO_CARTAO);
            const sigiloso = await servidor.chamar("get", "/projetos/p-s", { usuario: g });
            expect(sigiloso.status).toBe(200);
            expect(sigiloso.corpo.cartao).toBe(true);
            const gerenteEmS = await servidor.chamar("put", "/projetos/p-s/colunas", { usuario: g, corpo: { colunas: [] } });
            expect(gerenteEmS.status).toBe(403);
            expect(gerenteEmS.corpo.codigo).toBe("PROJETO_SEM_ACESSO");
            const colunas = await servidor.chamar("put", "/projetos/p-n/colunas", { usuario: m, corpo: { colunas: [] } });
            expect(colunas.status).toBe(403);
            expect(colunas.corpo.codigo).toBe("PROJETO_SEM_ACESSO");
        });

        it("PUT /projetos/:N por quem só tem o cartão: 403 PROJETO_SEM_ACESSO", async () => {
            // O membro para antes, em projetos.editar (403 da permissão); a regra do projeto aparece com o gerente num sigiloso alheio.
            const r = await servidor.chamar("put", "/projetos/p-s", {
                usuario: g,
                corpo: { nome: "X", descricao: "d", dataInicio: iso(inicio), dataFim: iso(fim) },
            });
            expect(r.status).toBe(403);
            expect(r.corpo.codigo).toBe("PROJETO_SEM_ACESSO");
            const membro = await servidor.chamar("put", "/projetos/p-n", {
                usuario: m,
                corpo: { nome: "X", descricao: "d", dataInicio: iso(inicio), dataFim: iso(fim) },
            });
            expect(membro.status).toBe(403);
        });

        it("projeto inexistente: 404", async () => {
            expect((await servidor.chamar("get", "/projetos/nao-existe", { usuario: m })).status).toBe(404);
        });

        it("PUT /projetos/:codigo/acesso não existe mais: 404", async () => {
            const r = await servidor.chamar("put", "/projetos/p-s/acesso", { usuario: d, corpo: { codigos: [] } });
            expect(r.status).toBe(404);
        });
    });

    describe("tarefas de projeto que a pessoa só vê pelo cartão", () => {
        it("membro de fora em tarefa de normal: o mesmo 404 da tarefa inexistente (anexos e comentários)", async () => {
            expect((await servidor.chamar("get", "/tarefas/t-n/anexos", { usuario: m })).status).toBe(404);
            const inexistente = await servidor.chamar("get", "/tarefas/t-nao-existe/comentarios", { usuario: m });
            const r = await servidor.chamar("get", "/tarefas/t-n/comentarios", { usuario: m });
            expect(r.status).toBe(404);
            expect(r.corpo).toEqual(inexistente.corpo);
            // Gestão segue vendo.
            expect((await servidor.chamar("get", "/tarefas/t-n/comentarios", { usuario: d })).status).toBe(200);
        });

        it("gerente de fora em tarefa de sigiloso: 404 (anexos e comentários)", async () => {
            expect((await servidor.chamar("get", "/tarefas/t-s/anexos", { usuario: g })).status).toBe(404);
            expect((await servidor.chamar("get", "/tarefas/t-s/comentarios", { usuario: g })).status).toBe(404);
        });
    });

    describe("ocupação com sigiloso alheio", () => {
        it("gerente de outra área e membro: linha do projeto com o nome (sessão 27b)", async () => {
            const gerente = await servidor.chamar("get", `/ocupacao/${m2.codigo}`, { usuario: g });
            expect(gerente.status).toBe(200);
            expect(gerente.corpo.itens).toContainEqual({ tipo: "projeto", projeto: { codigo: "p-s", nome: "Sigiloso Beta" }, horas: 1.5 });
            const membro = await servidor.chamar("get", `/ocupacao/${m2.codigo}`, { usuario: m });
            expect(membro.corpo.itens).toContainEqual({ tipo: "projeto", projeto: { codigo: "p-s", nome: "Sigiloso Beta" }, horas: 1.5 });
            expect(membro.corpo.itens.some((i: any) => i.tipo === "outras")).toBe(false);
        });
    });
});
