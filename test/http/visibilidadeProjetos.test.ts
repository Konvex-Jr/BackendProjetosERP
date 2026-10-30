import Usuario from "../../source/domain/Entity/Usuario";
import Projeto from "../../source/domain/Entity/Projeto";
import PerfilUsuario from "../../source/domain/Enum/PerfilUsuario";
import { criarContexto, criarTarefa, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Decisão de 30/10/2026: gerente e diretor veem todos os projetos; membro só os de que participa ou participou. */
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

    it("membro lista só os próprios projetos, mesmo pedindo os de outra pessoa", async () => {
        const lista = await servidor.chamar("get", "/projetos", { usuario: ctx.membro });
        expect(lista.status).toBe(200);
        expect(lista.corpo.map((p: any) => p.codigo)).toEqual(["proj-meu"]);

        const deOutro = await servidor.chamar("get", `/projetos?codigoUsuario=${outroMembro.codigo}`, { usuario: ctx.membro });
        expect(deOutro.corpo.map((p: any) => p.codigo)).toEqual(["proj-meu"]);
    });

    it("membro não abre projeto de que não participa", async () => {
        expect((await servidor.chamar("get", "/projetos/proj-meu", { usuario: ctx.membro })).status).toBe(200);
        expect((await servidor.chamar("get", "/projetos/proj-alheio", { usuario: ctx.membro })).status).toBe(403);
    });

    it("gerente vê todos e pode filtrar por pessoa", async () => {
        const todos = await servidor.chamar("get", "/projetos", { usuario: ctx.gerente });
        expect(todos.corpo.map((p: any) => p.codigo).sort()).toEqual(["proj-alheio", "proj-meu"]);
        const doBruno = await servidor.chamar("get", `/projetos?codigoUsuario=${outroMembro.codigo}`, { usuario: ctx.gerente });
        expect(doBruno.corpo.map((p: any) => p.codigo)).toEqual(["proj-alheio"]);
        expect((await servidor.chamar("get", "/projetos/proj-alheio", { usuario: ctx.gerente })).status).toBe(200);
    });

    it("membro só recebe tarefas dos próprios projetos", async () => {
        const repo = ctx.factory.criarProjetoRepository();
        await criarTarefa(ctx.factory, outroMembro, (await repo.buscarPorCodigo("proj-alheio"))!);
        expect((await servidor.chamar("get", "/tarefas", { usuario: ctx.membro })).corpo).toEqual([]);
        expect((await servidor.chamar("get", "/tarefas", { usuario: ctx.gerente })).corpo).toHaveLength(1);
    });
});
