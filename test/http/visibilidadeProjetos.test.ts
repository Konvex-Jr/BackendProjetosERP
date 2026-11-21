import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import Tarefa from "../../source/domain/entity/Tarefa";
import StatusTarefa from "../../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../../source/domain/enum/PrioridadeTarefa";
import { criarContexto, criarTarefa, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/**
 * Decisão de 30/10/2026, revista na sessão 27a: gerente e diretor veem todos os projetos completos; o membro vê
 * completos os de que participa ou participou e os demais como cartão.
 */
describe("Visibilidade de projetos", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let outroMembro: Usuario;

    beforeEach(async () => {
        ctx = await criarContexto();
        outroMembro = new Usuario("Bruno", "bruno@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-bruno");
        await ctx.factory.criarUsuarioRepository().criar(outroMembro);
        const repo = ctx.factory.criarProjetoRepository();
        await repo.criar(new Projeto("Meu projeto", "d", dataInicio, dataFim, undefined, [ctx.membro], "proj-meu"));
        await repo.criar(new Projeto("Projeto alheio", "d", dataInicio, dataFim, undefined, [outroMembro], "proj-alheio"));
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("membro lista todos: os próprios completos e os alheios como cartão; filtro de outra pessoa não revela a equipe", async () => {
        const lista = await servidor.chamar("get", "/projetos", { usuario: ctx.membro });
        expect(lista.status).toBe(200);
        const porCodigo = new Map(lista.corpo.map((p: any) => [p.codigo, p]));
        expect([...porCodigo.keys()].sort()).toEqual(["proj-alheio", "proj-meu"]);
        expect((porCodigo.get("proj-meu") as any).cartao).toBeUndefined();
        expect((porCodigo.get("proj-alheio") as any).cartao).toBe(true);

        const deOutro = await servidor.chamar("get", `/projetos?codigoUsuario=${outroMembro.codigo}`, { usuario: ctx.membro });
        expect(deOutro.corpo).toEqual([]);
    });

    it("membro abre o próprio projeto completo e o alheio só como cartão", async () => {
        expect((await servidor.chamar("get", "/projetos/proj-meu", { usuario: ctx.membro })).corpo.cartao).toBeUndefined();
        const alheio = await servidor.chamar("get", "/projetos/proj-alheio", { usuario: ctx.membro });
        expect(alheio.status).toBe(200);
        expect(alheio.corpo.cartao).toBe(true);
        expect(alheio.corpo.participacoes).toBeUndefined();
    });

    it("gerente vê todos e pode filtrar por pessoa", async () => {
        const todos = await servidor.chamar("get", "/projetos", { usuario: ctx.gerente });
        expect(todos.corpo.map((p: any) => p.codigo).sort()).toEqual(["proj-alheio", "proj-meu"]);
        const doBruno = await servidor.chamar("get", `/projetos?codigoUsuario=${outroMembro.codigo}`, { usuario: ctx.gerente });
        expect(doBruno.corpo.map((p: any) => p.codigo)).toEqual(["proj-alheio"]);
        expect((await servidor.chamar("get", "/projetos/proj-alheio", { usuario: ctx.gerente })).status).toBe(200);
    });

    it("perfil de outra pessoa não mostra ao membro projetos de que ele não participa", async () => {
        const visto = await servidor.chamar("get", `/usuarios/${outroMembro.codigo}/perfil`, { usuario: ctx.membro });
        expect(visto.status).toBe(200);
        expect(visto.corpo.projetosAtuais).toEqual([]);
        expect(visto.corpo.projetosAnteriores).toEqual([]);
        expect(visto.corpo.ocupacao.percentual).toBe(0);
        expect(visto.corpo.ocupacao.itens).toEqual([]);
        expect(visto.corpo.alocacao).toBeUndefined();

        const pelaGestao = await servidor.chamar("get", `/usuarios/${outroMembro.codigo}/perfil`, { usuario: ctx.gerente });
        expect(pelaGestao.corpo.projetosAtuais.map((p: any) => p.codigo)).toEqual(["proj-alheio"]);

        const proprio = await servidor.chamar("get", `/usuarios/${ctx.membro.codigo}/perfil`, { usuario: ctx.membro });
        expect(proprio.corpo.projetosAtuais.map((p: any) => p.codigo)).toEqual(["proj-meu"]);
    });

    it("progresso do projeto conta todas as tarefas, igual para membro e gestão", async () => {
        const repo = ctx.factory.criarProjetoRepository();
        const projeto = await repo.criar(
            new Projeto("Projeto dupla", "d", dataInicio, dataFim, undefined, [ctx.membro, outroMembro], "proj-dupla"),
        );
        const tarefas = ctx.factory.criarTarefaRepository();
        const nova = (codigo: string, status: StatusTarefa, responsavel: Usuario) =>
            tarefas.criar(
                new Tarefa(
                    projeto,
                    codigo,
                    dataInicio,
                    dataFim,
                    status,
                    PrioridadeTarefa.P2,
                    null,
                    status === StatusTarefa.CONCLUIDA ? dataFim : null,
                    null,
                    [responsavel],
                    [],
                    codigo,
                ),
            );
        await nova("t1", StatusTarefa.CONCLUIDA, ctx.membro);
        await nova("t2", StatusTarefa.PENDENTE, outroMembro);
        await nova("t3", StatusTarefa.PENDENTE, outroMembro);

        const esperado = { total: 3, concluidas: 1 };
        const doMembro = await servidor.chamar("get", "/projetos", { usuario: ctx.membro });
        expect(doMembro.corpo.find((p: any) => p.codigo === "proj-dupla").tarefas).toMatchObject(esperado);
        const daGestao = await servidor.chamar("get", "/projetos", { usuario: ctx.gerente });
        expect(daGestao.corpo.find((p: any) => p.codigo === "proj-dupla").tarefas).toMatchObject(esperado);
        expect(daGestao.corpo.find((p: any) => p.codigo === "proj-alheio").tarefas).toMatchObject({ total: 0, concluidas: 0 });
        expect((await servidor.chamar("get", "/projetos/proj-dupla", { usuario: ctx.membro })).corpo.tarefas).toMatchObject(esperado);
    });

    it("membro só recebe tarefas dos próprios projetos", async () => {
        const repo = ctx.factory.criarProjetoRepository();
        await criarTarefa(ctx.factory, outroMembro, (await repo.buscarPorCodigo("proj-alheio"))!);
        expect((await servidor.chamar("get", "/tarefas", { usuario: ctx.membro })).corpo).toEqual([]);
        expect((await servidor.chamar("get", "/tarefas", { usuario: ctx.gerente })).corpo).toHaveLength(1);
    });
});
