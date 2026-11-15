import { hash } from "bcrypt";
import Usuario from "../source/domain/entity/Usuario";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import Projeto from "../source/domain/entity/Projeto";
import { criarContexto, criarProjeto, criarTarefa, dataFim, dataInicio } from "./fixtures";
import { subirServidor, tokenPara } from "./http/servidorTeste";

/** Sessão 20: trainee entra como membro, sem Biblioteca e sem liderança. */
describe("Trainee", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let trainee: Usuario;
    const PDF = Buffer.from("%PDF-1.4 teste");

    const enviar = async (usuario: Usuario, caminho: string) => {
        const r = await fetch(servidor.base + caminho, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream", "X-Nome-Arquivo": "a.pdf", "access-token": tokenPara(usuario) },
            body: new Uint8Array(PDF),
        });
        return { status: r.status, corpo: JSON.parse((await r.text()) || "null") };
    };

    beforeEach(async () => {
        ctx = await criarContexto();
        trainee = new Usuario(
            "Tina Trainee",
            "tina@konvex.com.br",
            PerfilUsuario.MEMBRO,
            true,
            await hash("senha-forte-1", 4),
            ctx.senioridade,
            "usr-tina",
            {
                status: StatusPessoa.TRAINEE,
            },
        );
        await ctx.factory.criarUsuarioRepository().criar(trainee);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("faz login e renova a sessão", async () => {
        const login = await servidor.chamar("post", "/auth/login", { corpo: { email: trainee.email, senha: "senha-forte-1" } });
        expect(login.status).toBe(200);
        const refresh = login.corpo.refreshToken;
        expect(refresh).toBeTruthy();
        const renovado = await servidor.chamar("post", "/auth/refresh", { corpo: { refreshToken: refresh } });
        expect(renovado.status).toBe(200);
    });

    it("menu sem Biblioteca (o do membro Ativo tem)", async () => {
        const dele = await servidor.chamar("get", "/auth/permissoes", { usuario: trainee });
        expect(dele.status).toBe(200);
        expect(dele.corpo.menu.map((i: any) => i.chave)).not.toContain("biblioteca");
        expect(dele.corpo.modulos.map((m: any) => m.chave)).not.toContain("biblioteca");
        const ativo = await servidor.chamar("get", "/auth/permissoes", { usuario: ctx.membro });
        expect(ativo.corpo.menu.map((i: any) => i.chave)).toContain("biblioteca");
    });

    it("Biblioteca: 403 em todas as rotas, inclusive anexos de item", async () => {
        const item = (await servidor.chamar("post", "/biblioteca", { usuario: ctx.membro, corpo: { titulo: "Pesquisa" } })).corpo;
        const anexo = (await enviar(ctx.membro, `/biblioteca/${item.codigo}/anexos`)).corpo;
        const barrar = async (metodo: string, caminho: string, corpo?: unknown) => {
            const r = await servidor.chamar(metodo, caminho, { usuario: trainee, corpo });
            expect([metodo, caminho, r.status]).toEqual([metodo, caminho, 403]);
            expect(r.corpo.message).toMatch(/Biblioteca/);
        };
        await barrar("get", "/biblioteca");
        await barrar("get", `/biblioteca/${item.codigo}`);
        await barrar("post", "/biblioteca", { titulo: "X" });
        await barrar("put", `/biblioteca/${item.codigo}`, { titulo: "Y" });
        await barrar("delete", `/biblioteca/${item.codigo}`);
        await barrar("get", `/anexos/${anexo.codigo}`);
        await barrar("delete", `/anexos/${anexo.codigo}`);
        const envio = await enviar(trainee, `/biblioteca/${item.codigo}/anexos`);
        expect(envio.status).toBe(403);
    });

    it("projetos e tarefas só da equipe; capacitações e pessoas liberadas", async () => {
        const meu = await criarProjeto(ctx.factory, trainee);
        await criarTarefa(ctx.factory, trainee, meu, "tarefa-dele");
        await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("Alheio", "Sem o trainee", dataInicio, dataFim, undefined, [ctx.membro], "projeto-alheio"));
        const projetos = await servidor.chamar("get", "/projetos", { usuario: trainee });
        expect(projetos.status).toBe(200);
        expect(projetos.corpo.map((p: any) => p.codigo)).toEqual([meu.codigo]);
        const tarefas = await servidor.chamar("get", "/tarefas", { usuario: trainee });
        expect(tarefas.status).toBe(200);
        expect(tarefas.corpo.map((t: any) => t.codigo)).toEqual(["tarefa-dele"]);
        expect((await servidor.chamar("get", "/capacitacoes", { usuario: trainee })).status).toBe(200);
        expect((await servidor.chamar("get", "/usuarios", { usuario: trainee })).status).toBe(200);
    });

    it("trainee que vira Ativo acessa a Biblioteca sem novo login", async () => {
        expect((await servidor.chamar("get", "/biblioteca", { usuario: trainee })).status).toBe(403);
        const r = await servidor.chamar("patch", `/usuarios/${trainee.codigo}/status`, {
            usuario: ctx.gerente,
            corpo: { status: StatusPessoa.ATIVO },
        });
        expect(r.status).toBe(200);
        expect((await servidor.chamar("get", "/biblioteca", { usuario: trainee })).status).toBe(200);
    });

    describe("sempre membro", () => {
        const dados = { nome: "Novo", email: "novo@konvex.com.br", senha: "senha-forte-1", senioridade: { codigo: "pleno" } };

        it("criar trainee gerente: 400 TRAINEE_SO_MEMBRO", async () => {
            const r = await servidor.chamar("post", "/usuarios", {
                usuario: ctx.gerente,
                corpo: { ...dados, status: "trainee", perfil: "gerente" },
            });
            expect(r.status).toBe(400);
            expect(r.corpo.code ?? r.corpo.codigo).toBe("TRAINEE_SO_MEMBRO");
            const ok = await servidor.chamar("post", "/usuarios", { usuario: ctx.gerente, corpo: { ...dados, status: "trainee" } });
            expect(ok.status).toBe(200);
        });

        it("mudar gerente para trainee: 400", async () => {
            const r = await servidor.chamar("patch", `/usuarios/${ctx.gerente.codigo}/status`, {
                usuario: ctx.gerente,
                corpo: { status: "trainee" },
            });
            // o próprio gerente não muda o status (403); outro diretor muda
            expect(r.status).toBe(403);
            const diretor = new Usuario("Dir", "dir@konvex.com.br", PerfilUsuario.DIRETOR, true, "x", ctx.senioridade, "usr-dir");
            await ctx.factory.criarUsuarioRepository().criar(diretor);
            const r2 = await servidor.chamar("patch", `/usuarios/${ctx.gerente.codigo}/status`, {
                usuario: diretor,
                corpo: { status: "trainee" },
            });
            expect(r2.status).toBe(400);
            expect(r2.corpo.code ?? r2.corpo.codigo).toBe("TRAINEE_SO_MEMBRO");
        });

        it("editar trainee para gerente: 400", async () => {
            const r = await servidor.chamar("put", `/usuarios/${trainee.codigo}`, { usuario: ctx.gerente, corpo: { perfil: "gerente" } });
            expect(r.status).toBe(400);
            expect(r.corpo.code ?? r.corpo.codigo).toBe("TRAINEE_SO_MEMBRO");
        });
    });

    it("líder: trainee da equipe não pode (400 TRAINEE_NAO_LIDERA)", async () => {
        const projeto = await criarProjeto(ctx.factory, trainee);
        const r = await servidor.chamar("put", `/projetos/${projeto.codigo}/lider`, {
            usuario: ctx.gerente,
            corpo: { codigoUsuario: trainee.codigo },
        });
        expect(r.status).toBe(400);
        expect(r.corpo.code ?? r.corpo.codigo).toBe("TRAINEE_NAO_LIDERA");
    });

    it("membro que lidera vira trainee: perde a liderança e não organiza tarefas", async () => {
        const projeto = await criarProjeto(ctx.factory, ctx.membro);
        await ctx.factory.criarProjetoRepository().editar(projeto.copiar({ participacoes: projeto.participacoes, lider: ctx.membro }));
        await criarTarefa(ctx.factory, ctx.gerente, projeto, "tarefa-outro");
        const antes = await servidor.chamar("get", `/projetos/${projeto.codigo}`, { usuario: ctx.gerente });
        expect(antes.corpo.lider?.codigo).toBe(ctx.membro.codigo);

        const r = await servidor.chamar("patch", `/usuarios/${ctx.membro.codigo}/status`, {
            usuario: ctx.gerente,
            corpo: { status: StatusPessoa.TRAINEE },
        });
        expect(r.status).toBe(200);
        const depois = await servidor.chamar("get", `/projetos/${projeto.codigo}`, { usuario: ctx.gerente });
        expect(depois.corpo.lider).toBeNull();

        const edicao = await servidor.chamar("put", "/tarefas/tarefa-outro", {
            usuario: ctx.membro,
            corpo: { titulo: "Novo", dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() },
        });
        expect(edicao.status).toBe(403);
    });
});
