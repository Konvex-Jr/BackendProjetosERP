import Usuario from "../../source/domain/entity/Usuario";
import { criarContexto, criarProjeto, criarTarefa } from "../fixtures";
import { subirServidor } from "./servidorTeste";
import { comPapel, darCargo } from "../papel";

/**
 * Cobre as falhas S1 a S6 encontradas no diagnóstico de 29/10/2026.
 */
describe("Segurança da API", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let diretor: Usuario;
    let outroMembro: Usuario;

    beforeEach(async () => {
        ctx = await criarContexto();
        diretor = comPapel(new Usuario("Diretora", "diretora@konvex.com.br", true, "x", ctx.senioridade, "usr-dir"), "diretor");
        outroMembro = comPapel(new Usuario("Bruno", "bruno@konvex.com.br", true, "x", ctx.senioridade, "usr-bruno"), "membro");
        await ctx.factory.criarUsuarioRepository().criar(diretor);
        await ctx.factory.criarUsuarioRepository().criar(outroMembro);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("S2: rotas de check-in foram retiradas (03/11)", async () => {
        const r = await servidor.chamar("get", "/checkins", { usuario: ctx.gerente });
        expect(r.status).toBe(404);
    });

    it("sessão 17: Gestão, Base e Iniciativas saíram (a Biblioteca substitui)", async () => {
        for (const caminho of ["/pastas", "/documentos", "/conhecimento", "/iniciativas", "/iniciativas/opcoes"]) {
            const r = await servidor.chamar("get", caminho, { usuario: diretor });
            expect([caminho, r.status]).toEqual([caminho, 404]);
        }
    });

    it("S1: não existe cadastro público de contas", async () => {
        const r = await servidor.chamar("post", "/auth/register", {
            corpo: { nome: "Intruso", email: "x@x.com", senha: "123456", senioridade: { codigo: "pleno" } },
        });
        expect(r.status).toBe(404);
        expect(await ctx.factory.criarUsuarioRepository().buscarPorEmail("x@x.com")).toBeNull();
    });

    it("S3: membro não faz inscrição em nome de outra pessoa", async () => {
        const inscricao = await servidor.chamar("post", `/capacitacoes/${ctx.capacitacao.codigo}/inscricoes`, {
            usuario: ctx.membro,
            corpo: { codigoUsuario: outroMembro.codigo },
        });
        expect(inscricao.status).toBe(403);

        const gestorInscreve = await servidor.chamar("post", `/capacitacoes/${ctx.capacitacao.codigo}/inscricoes`, {
            usuario: ctx.gerente,
            corpo: { codigoUsuario: outroMembro.codigo },
        });
        expect(gestorInscreve.status).toBe(200);

        const cancelaDeOutro = await servidor.chamar("delete", `/capacitacoes/${ctx.capacitacao.codigo}/inscricoes/${outroMembro.codigo}`, {
            usuario: ctx.membro,
        });
        expect(cancelaDeOutro.status).toBe(403);
    });

    it("S4: membro não cria projetos nem altera tarefas de outras pessoas (CT-002)", async () => {
        const criar = await servidor.chamar("post", "/projetos", {
            usuario: ctx.membro,
            corpo: { nome: "P", descricao: "D", dataInicio: "2026-10-01", dataFim: "2026-12-01" },
        });
        expect(criar.status).toBe(403);

        const projeto = await criarProjeto(ctx.factory, ctx.membro);
        const excluir = await servidor.chamar("delete", `/projetos/${projeto.codigo}`, { usuario: ctx.membro });
        expect(excluir.status).toBe(403);

        const tarefaDoMembro = await criarTarefa(ctx.factory, ctx.membro, projeto);
        // Fora do projeto (só o cartão): 404, como a tarefa inexistente (sessão 27a; antes, 403).
        const porOutro = await servidor.chamar("delete", `/tarefas/${tarefaDoMembro.codigo}`, { usuario: outroMembro });
        expect(porOutro.status).toBe(404);

        const peloDono = await servidor.chamar("patch", `/tarefas/${tarefaDoMembro.codigo}/status`, {
            usuario: ctx.membro,
            corpo: { status: "andamento" },
        });
        expect(peloDono.status).toBe(200);

        const sigiloso = await servidor.chamar("post", "/biblioteca", { usuario: ctx.membro, corpo: { titulo: "X", sigilo: "gestao" } });
        expect(sigiloso.status).toBe(403);
    });

    it("S4: membro só cria tarefas para si, em projetos de que participa", async () => {
        const projeto = await criarProjeto(ctx.factory, ctx.membro);
        const corpo = {
            codigoProjeto: projeto.codigo,
            titulo: "Minha tarefa",
            dataInicio: "2026-10-12",
            dataFim: "2026-10-16",
            prioridade: "P2",
            codigosResponsaveis: [outroMembro.codigo],
        };
        const foraDoProjeto = await servidor.chamar("post", "/tarefas", { usuario: outroMembro, corpo });
        expect(foraDoProjeto.status).toBe(403);

        const noProjeto = await servidor.chamar("post", "/tarefas", { usuario: ctx.membro, corpo });
        expect(noProjeto.status).toBe(200);
        expect(noProjeto.corpo.responsaveis.map((r: any) => r.codigo)).toEqual([ctx.membro.codigo]);
    });

    it("S5: gerente não altera diretores; diretor altera quem está abaixo (31a: pela posição do cargo)", async () => {
        await darCargo(ctx.factory, diretor, "diretor");
        const inativarDiretor = await servidor.chamar("delete", `/usuarios/${diretor.codigo}`, { usuario: ctx.gerente });
        expect(inativarDiretor.status).toBe(403);
        const editarDiretor = await servidor.chamar("put", `/usuarios/${diretor.codigo}`, {
            usuario: ctx.gerente,
            corpo: { nome: "Outro nome", email: diretor.email, senioridade: { codigo: "pleno", nome: "Pleno", valorHora: 75 } },
        });
        expect(editarDiretor.status).toBe(403);

        const diretorEdita = await servidor.chamar("put", `/usuarios/${ctx.membro.codigo}`, {
            usuario: diretor,
            corpo: {
                nome: ctx.membro.nome,
                email: ctx.membro.email,
                senioridade: { codigo: "pleno", nome: "Pleno", valorHora: 75 },
            },
        });
        expect(diretorEdita.status).toBe(200);
    });

    it("S6: CORS só responde para origens configuradas", async () => {
        const permitida = await servidor.chamar("get", "/", { cabecalhos: { Origin: "http://localhost:5173" } });
        expect(permitida.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");

        const estranha = await servidor.chamar("get", "/", { cabecalhos: { Origin: "https://evil.example" } });
        expect(estranha.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("rotas protegidas exigem token", async () => {
        const r = await servidor.chamar("get", "/usuarios");
        expect(r.status).toBe(401);
    });
});
