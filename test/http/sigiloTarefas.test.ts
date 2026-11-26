import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import { criarContexto, criarTarefa, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";
import { Papel, comPapel } from "../papel";

/** Sessão 20: tarefas, comentários e anexos de tarefa de projeto sigiloso. */
describe("Tarefas de projeto sigiloso", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let equipe: Usuario; // equipe atual
    let ex: Usuario; // saiu do sigiloso, não é responsável por nada
    let exResponsavel: Usuario; // saiu do sigiloso e ainda é responsável por uma tarefa
    let criadorFora: Usuario; // membro que criou o sigiloso, fora da equipe
    let fora: Usuario; // membro sem relação
    let gerenteFora: Usuario;
    let diretor: Usuario;

    const chamar = (metodo: string, caminho: string, usuario: Usuario, corpo?: unknown) =>
        servidor.chamar(metodo, caminho, { usuario, corpo });
    const codigos = (corpo: any[]) => corpo.map((t) => t.codigo).sort();

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const novo = async (nome: string, perfil: Papel, codigo: string) => {
            const u = comPapel(new Usuario(nome, `${codigo}@konvex.com.br`, true, "x", ctx.senioridade, codigo), perfil);
            await usuarios.criar(u);
            return u;
        };
        equipe = ctx.membro;
        ex = await novo("Eva", "membro", "usr-eva");
        exResponsavel = await novo("Ruy", "membro", "usr-ruy");
        criadorFora = await novo("Lia", "membro", "usr-lia");
        fora = await novo("Fê", "membro", "usr-fe");
        gerenteFora = await novo("Gui", "gerenteDaArea", "usr-gui");
        diretor = await novo("Dora", "diretor", "usr-dora");

        const projetos = ctx.factory.criarProjetoRepository();
        const sigiloso = await projetos.criar(
            new Projeto("Sigiloso", "d", dataInicio, dataFim, undefined, [equipe, ex, exResponsavel], "proj-sig", {
                criadoPor: criadorFora.codigo,
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
        it("gerente de outra área não recebe tarefa de projeto que não abre (31a: todo projeto é fechado)", async () => {
            const r = await chamar("get", "/tarefas", gerenteFora);
            expect(r.status).toBe(200);
            expect(codigos(r.corpo)).toEqual([]);
        });

        it("ex-membro segue recebendo as tarefas do projeto (31a: quem sai não perde o acesso)", async () => {
            const r = await chamar("get", "/tarefas", ex);
            expect(codigos(r.corpo)).toEqual(["t-sig", "t-sig-ex"]);
            const q = await chamar("get", "/tarefas?minhas=true", exResponsavel);
            expect(codigos(q.corpo)).toEqual(["t-sig-ex"]);
        });

        it("membro que só criou o sigiloso (fora da equipe) não recebe tarefa dele (sessão 27a)", async () => {
            const r = await chamar("get", "/tarefas", criadorFora);
            expect(codigos(r.corpo)).toEqual([]);
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
            ["patch", "/tarefas/t-sig/checklist/qualquer", () => ({ feito: true })],
            ["get", "/tarefas/t-sig/comentarios", () => undefined],
            ["post", "/tarefas/t-sig/comentarios", () => ({ texto: "oi" })],
        ];

        it.each(rotas)("%s %s: membro fora e criador fora recebem 404", async (metodo, caminho, corpo) => {
            for (const u of [fora, criadorFora]) {
                const r = await chamar(metodo, caminho, u, corpo());
                expect(r.status).toBe(404);
            }
        });

        it.each(rotas)("%s %s: membro fora recebe o mesmo 404 da tarefa inexistente", async (metodo, caminho, corpo) => {
            const inexistente = await chamar(metodo, caminho.replace("t-sig", "t-nao-existe"), fora, corpo());
            const r = await chamar(metodo, caminho, fora, corpo());
            expect(inexistente.status).toBe(404);
            expect(r.status).toBe(404);
            expect(r.corpo).toEqual(inexistente.corpo);
        });

        it.each(rotas)("%s %s: gerente fora recebe o mesmo 404 (sessão 27a; antes 403)", async (metodo, caminho, corpo) => {
            const inexistente = await chamar(metodo, caminho.replace("t-sig", "t-nao-existe"), gerenteFora, corpo());
            const r = await chamar(metodo, caminho, gerenteFora, corpo());
            expect(r.status).toBe(404);
            expect(r.corpo).toEqual(inexistente.corpo);
        });

        it("anexos da tarefa: 404 para quem não vê, qualquer papel", async () => {
            for (const u of [fora, gerenteFora, criadorFora]) {
                const r = await chamar("get", "/tarefas/t-sig/anexos", u);
                expect(r.status).toBe(404);
            }
        });

        it("equipe atual comenta; tarefa normal segue como antes (gerente organiza)", async () => {
            expect((await chamar("post", "/tarefas/t-sig/comentarios", equipe, { texto: "oi" })).status).toBe(200);
            expect((await chamar("patch", "/tarefas/t-nor/status", ctx.gerente, { status: "concluida" })).status).toBe(200);
        });
    });

    describe("POST /tarefas em projeto sigiloso", () => {
        const corpo = { codigoProjeto: "proj-sig", titulo: "nova", dataInicio, dataFim, prioridade: "p2" };
        it("membro e gerente fora: 403 PROJETO_SEM_ACESSO (o nome do projeto é público desde a sessão 27a)", async () => {
            for (const u of [fora, gerenteFora]) {
                const r = await chamar("post", "/tarefas", u, corpo);
                expect(r.status).toBe(403);
                expect(r.corpo.codigo).toBe("PROJETO_SEM_ACESSO");
            }
        });
    });
});
