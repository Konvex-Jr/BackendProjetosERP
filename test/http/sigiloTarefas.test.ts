import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto, criarTarefa, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 20: tarefas, comentários e anexos de tarefa de projeto sigiloso. */
describe("Tarefas de projeto sigiloso", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let equipe: Usuario; // equipe atual
    let ex: Usuario; // saiu do sigiloso, não é responsável por nada
    let exResponsavel: Usuario; // saiu do sigiloso e ainda é responsável por uma tarefa
    let naLista: Usuario; // membro na lista de acesso, fora da equipe
    let fora: Usuario; // membro sem relação
    let gerenteFora: Usuario;
    let diretor: Usuario;

    const chamar = (metodo: string, caminho: string, usuario: Usuario, corpo?: unknown) =>
        servidor.chamar(metodo, caminho, { usuario, corpo });
    const codigos = (corpo: any[]) => corpo.map((t) => t.codigo).sort();

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const novo = async (nome: string, perfil: PerfilUsuario, codigo: string) => {
            const u = new Usuario(nome, `${codigo}@konvex.com.br`, perfil, true, "x", ctx.senioridade, codigo);
            await usuarios.criar(u);
            return u;
        };
        equipe = ctx.membro;
        ex = await novo("Eva", PerfilUsuario.MEMBRO, "usr-eva");
        exResponsavel = await novo("Ruy", PerfilUsuario.MEMBRO, "usr-ruy");
        naLista = await novo("Lia", PerfilUsuario.MEMBRO, "usr-lia");
        fora = await novo("Fê", PerfilUsuario.MEMBRO, "usr-fe");
        gerenteFora = await novo("Gui", PerfilUsuario.GERENTE, "usr-gui");
        diretor = await novo("Dora", PerfilUsuario.DIRETOR, "usr-dora");

        const projetos = ctx.factory.criarProjetoRepository();
        const sigiloso = await projetos.criar(
            new Projeto("Sigiloso", "d", dataInicio, dataFim, undefined, [equipe, ex, exResponsavel], "proj-sig", {
                sigiloso: true,
                criadoPor: "usr-dora",
                acesso: [naLista.codigo],
            }),
        );
        await projetos.criar(new Projeto("Normal", "d", dataInicio, dataFim, undefined, [equipe], "proj-nor"));
        await criarTarefa(ctx.factory, equipe, sigiloso, "t-sig");
        await criarTarefa(ctx.factory, exResponsavel, sigiloso, "t-sig-ex");
        await criarTarefa(ctx.factory, equipe, (await projetos.buscarPorCodigo("proj-nor"))!, "t-nor");
        servidor = await subirServidor(ctx.factory);
        // ex e exResponsavel saem da equipe depois de criadas as tarefas
        for (const u of [ex, exResponsavel]) {
            const part = (await projetos.buscarPorCodigo("proj-sig"))!.participacaoAtivaDe(u.codigo)!;
            const r = await servidor.chamar("post", `/projetos/proj-sig/membros/${part.codigo}/encerrar`, {
                usuario: diretor,
                corpo: {},
            });
            expect(r.status).toBeLessThan(300);
        }
    });

    afterEach(async () => servidor.fechar());

    describe("GET /tarefas", () => {
        it("gerente fora do sigiloso não recebe nenhuma tarefa dele, mas recebe as normais", async () => {
            const r = await chamar("get", "/tarefas", gerenteFora);
            expect(r.status).toBe(200);
            expect(codigos(r.corpo)).toEqual(["t-nor"]);
        });

        it("ex-membro que não é responsável não recebe tarefa do sigiloso", async () => {
            const r = await chamar("get", "/tarefas", ex);
            expect(codigos(r.corpo)).toEqual([]);
        });

        it("ex-membro que ainda é responsável também não recebe", async () => {
            const r = await chamar("get", "/tarefas", exResponsavel);
            expect(codigos(r.corpo)).toEqual([]);
            const q = await chamar("get", "/tarefas?minhas=true", exResponsavel);
            expect(codigos(q.corpo)).toEqual([]);
        });

        it("membro na lista de acesso, fora da equipe, recebe todas do sigiloso", async () => {
            const r = await chamar("get", "/tarefas", naLista);
            expect(codigos(r.corpo)).toEqual(["t-sig", "t-sig-ex"]);
        });

        it("equipe atual recebe todas do sigiloso e as normais", async () => {
            const r = await chamar("get", "/tarefas", equipe);
            expect(codigos(r.corpo)).toEqual(["t-nor", "t-sig", "t-sig-ex"]);
        });

        it("membro sem relação não recebe nada do sigiloso", async () => {
            const r = await chamar("get", "/tarefas", fora);
            expect(codigos(r.corpo)).toEqual([]);
        });

        it("diretor recebe todas", async () => {
            const r = await chamar("get", "/tarefas", diretor);
            expect(codigos(r.corpo)).toEqual(["t-nor", "t-sig", "t-sig-ex"]);
        });
    });

    describe("rotas de uma tarefa do sigiloso", () => {
        const corpoPut = { titulo: "x", dataInicio, dataFim, status: "pendente", prioridade: "p2", codigosResponsaveis: [] };
        const rotas: [string, string, () => unknown][] = [
            ["put", "/tarefas/t-sig", () => corpoPut],
            ["patch", "/tarefas/t-sig/status", () => ({ status: "concluida" })],
            ["delete", "/tarefas/t-sig", () => undefined],
            ["get", "/tarefas/t-sig/comentarios", () => undefined],
            ["post", "/tarefas/t-sig/comentarios", () => ({ texto: "oi" })],
        ];

        it.each(rotas)("%s %s: membro fora, ex-membro e ex-responsável recebem 404", async (metodo, caminho, corpo) => {
            for (const u of [fora, ex, exResponsavel]) {
                const r = await chamar(metodo, caminho, u, corpo());
                expect(r.status).toBe(404);
            }
        });

        it.each(rotas)("%s %s: gerente fora recebe 403", async (metodo, caminho, corpo) => {
            const r = await chamar(metodo, caminho, gerenteFora, corpo());
            expect(r.status).toBe(403);
        });

        it("anexos da tarefa: 404 para quem não vê, qualquer papel", async () => {
            for (const u of [fora, ex, exResponsavel, gerenteFora]) {
                const r = await chamar("get", "/tarefas/t-sig/anexos", u);
                expect(r.status).toBe(404);
            }
        });

        it("membro da lista de acesso lê comentários e anexos, mas não comenta nem muda status", async () => {
            expect((await chamar("get", "/tarefas/t-sig/comentarios", naLista)).status).toBe(200);
            expect((await chamar("get", "/tarefas/t-sig/anexos", naLista)).status).toBe(200);
            expect((await chamar("post", "/tarefas/t-sig/comentarios", naLista, { texto: "oi" })).status).toBe(403);
            expect((await chamar("patch", "/tarefas/t-sig/status", naLista, { status: "concluida" })).status).toBe(403);
        });

        it("equipe atual comenta; tarefa normal segue como antes (gerente organiza)", async () => {
            expect((await chamar("post", "/tarefas/t-sig/comentarios", equipe, { texto: "oi" })).status).toBe(200);
            expect((await chamar("patch", "/tarefas/t-nor/status", ctx.gerente, { status: "concluida" })).status).toBe(200);
        });
    });

    describe("POST /tarefas em projeto sigiloso", () => {
        const corpo = { codigoProjeto: "proj-sig", titulo: "nova", dataInicio, dataFim, prioridade: "p2" };
        it("membro fora 404; gerente fora 403", async () => {
            expect((await chamar("post", "/tarefas", fora, corpo)).status).toBe(404);
            expect((await chamar("post", "/tarefas", gerenteFora, corpo)).status).toBe(403);
        });
    });
});
