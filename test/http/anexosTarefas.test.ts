import Usuario from "../../source/domain/entity/Usuario";
import Anexo from "../../source/domain/entity/Anexo";
import { DonoAnexo } from "../../source/domain/enum/Anexo";
import Projeto from "../../source/domain/entity/Projeto";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto, criarTarefa, dataFim, dataInicio } from "../fixtures";
import { subirServidor, tokenPara } from "./servidorTeste";

/**
 * Sessão 19: anexos nas tarefas, com as regras dos comentários (`regrasTarefa`):
 * vê e baixa quem vê a tarefa; anexa quem comenta; exclui quem enviou ou quem organiza.
 * Quem não vê a tarefa recebe 404 em todas as rotas de anexo.
 */
describe("Anexos nas tarefas", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let lider: Usuario;
    let colega: Usuario;
    let deFora: Usuario;
    let exParticipante: Usuario;
    const PDF = Buffer.from("%PDF-1.4 conteúdo de teste");
    const TAREFA = "tarefa-teste";

    const enviar = async (usuario: Usuario, codigoTarefa: string, nome = "Plano de testes.pdf") => {
        const headers = {
            "Content-Type": "application/octet-stream",
            "X-Nome-Arquivo": encodeURIComponent(nome),
            "access-token": tokenPara(usuario),
        };
        const r = await fetch(`${servidor.base}/tarefas/${codigoTarefa}/anexos`, { method: "POST", headers, body: new Uint8Array(PDF) });
        const texto = await r.text();
        return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
    };
    const listar = (usuario: Usuario, codigoTarefa: string) => servidor.chamar("get", `/tarefas/${codigoTarefa}/anexos`, { usuario });
    const baixar = async (usuario: Usuario, codigo: string) => {
        const r = await fetch(`${servidor.base}/anexos/${codigo}`, { headers: { "access-token": tokenPara(usuario) } });
        return { status: r.status, headers: r.headers, bytes: Buffer.from(await r.arrayBuffer()) };
    };
    const excluir = (usuario: Usuario, codigo: string) => servidor.chamar("delete", `/anexos/${codigo}`, { usuario });

    beforeEach(async () => {
        ctx = await criarContexto();
        lider = ctx.membro;
        colega = new Usuario("Bruno", "bruno@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-bruno");
        deFora = new Usuario("Carla", "carla@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-carla");
        exParticipante = new Usuario("Davi", "davi@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-davi");
        for (const u of [colega, deFora, exParticipante]) await ctx.factory.criarUsuarioRepository().criar(u);
        await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("Time", "d", dataInicio, dataFim, undefined, [lider, colega, exParticipante], "proj-time"));
        servidor = await subirServidor(ctx.factory);
        await servidor.chamar("put", "/projetos/proj-time/lider", { usuario: ctx.gerente, corpo: { codigoUsuario: lider.codigo } });
        const projeto = (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!;
        await criarTarefa(ctx.factory, colega, projeto);
    });

    afterEach(async () => servidor.fechar());

    /** Encerra a participação (grava a dataSaida), como a gestão faz pela tela do projeto. */
    const tirarDaEquipe = async (usuario: Usuario) => {
        const projeto = (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!;
        const part = projeto.participacaoAtivaDe(usuario.codigo)!;
        const r = await servidor.chamar("post", `/projetos/proj-time/membros/${part.codigo}/encerrar`, { usuario: ctx.gerente, corpo: {} });
        expect(r.status).toBeLessThan(300);
    };

    it("participante anexa um PDF e a lista traz o arquivo com podeExcluir para ele", async () => {
        const r = await enviar(colega, TAREFA);
        expect(r.status).toBe(200);
        expect(r.corpo).toMatchObject({ nome: "Plano de testes.pdf", tipoMime: "application/pdf", tamanhoBytes: PDF.length });
        expect(r.corpo.enviadoPor.codigo).toBe(colega.codigo);
        expect(r.corpo.arquivo).toBeUndefined();

        const lista = await listar(colega, TAREFA);
        expect(lista.status).toBe(200);
        expect(lista.corpo).toEqual([expect.objectContaining({ codigo: r.corpo.codigo, nome: "Plano de testes.pdf", podeExcluir: true })]);
        expect(lista.corpo[0].arquivo).toBeUndefined();
    });

    it("lista do mais antigo ao mais novo", async () => {
        const primeiro = (await enviar(colega, TAREFA, "a.pdf")).corpo;
        await new Promise((r) => setTimeout(r, 5));
        const segundo = (await enviar(lider, TAREFA, "b.pdf")).corpo;
        expect((await listar(colega, TAREFA)).corpo.map((a: any) => a.codigo)).toEqual([primeiro.codigo, segundo.codigo]);
    });

    it("outro participante não exclui o anexo de outro; líder e gestão excluem", async () => {
        const a1 = (await enviar(colega, TAREFA, "a.pdf")).corpo;
        const a2 = (await enviar(colega, TAREFA, "b.pdf")).corpo;

        const vistaDoOutro = await listar(exParticipante, TAREFA);
        expect(vistaDoOutro.corpo.map((a: any) => a.podeExcluir)).toEqual([false, false]);
        const negado = await excluir(exParticipante, a1.codigo);
        expect(negado.status).toBe(403);
        expect(negado.corpo.message).toBe("Você só pode excluir os arquivos que enviou.");

        expect((await listar(lider, TAREFA)).corpo.map((a: any) => a.podeExcluir)).toEqual([true, true]);
        expect((await excluir(lider, a1.codigo)).status).toBe(200);
        expect((await excluir(ctx.gerente, a2.codigo)).status).toBe(200);
        expect((await listar(colega, TAREFA)).corpo).toEqual([]);
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
    });

    it("ex-participante vê e baixa, não anexa, mas exclui o que enviou antes de sair", async () => {
        const dele = (await enviar(exParticipante, TAREFA, "meu.pdf")).corpo;
        const doColega = (await enviar(colega, TAREFA, "do-colega.pdf")).corpo;
        await tirarDaEquipe(exParticipante);

        const lista = await listar(exParticipante, TAREFA);
        expect(lista.status).toBe(200);
        expect(lista.corpo.map((a: any) => [a.nome, a.podeExcluir])).toEqual([
            ["meu.pdf", true],
            ["do-colega.pdf", false],
        ]);
        const download = await baixar(exParticipante, doColega.codigo);
        expect(download.status).toBe(200);
        expect(download.bytes.equals(PDF)).toBe(true);
        expect(download.headers.get("cache-control")).toBe("private, no-store");

        const negado = await enviar(exParticipante, TAREFA, "novo.pdf");
        expect(negado.status).toBe(403);
        expect(negado.corpo.message).toBe("Só a equipe atual do projeto anexa arquivos nas tarefas.");

        expect((await excluir(exParticipante, doColega.codigo)).status).toBe(403);
        expect((await excluir(exParticipante, dele.codigo)).status).toBe(200);
    });

    it("quem não tem relação com o projeto recebe 404 nas quatro rotas", async () => {
        const anexo = (await enviar(colega, TAREFA)).corpo;
        expect((await enviar(deFora, TAREFA)).status).toBe(404);
        expect((await listar(deFora, TAREFA)).status).toBe(404);
        expect((await baixar(deFora, anexo.codigo)).status).toBe(404);
        expect((await excluir(deFora, anexo.codigo)).status).toBe(404);
        expect((await listar(colega, TAREFA)).corpo).toHaveLength(1);
    });

    it("tarefa inexistente ou código mal formado: 404, não 500", async () => {
        for (const codigo of ["7d0f8a8e-1111-4c2b-9a51-000000000000", "nao-e-uuid"]) {
            expect((await enviar(colega, codigo)).status).toBe(404);
            expect((await listar(colega, codigo)).status).toBe(404);
        }
    });

    it("download do anexo da tarefa vem como attachment com o nome original", async () => {
        const anexo = (await enviar(colega, TAREFA, "Relatório final.pdf")).corpo;
        const r = await baixar(lider, anexo.codigo);
        expect(r.status).toBe(200);
        expect(r.headers.get("content-disposition")).toMatch(/^attachment/);
        expect(r.headers.get("content-disposition")).toContain("Relat%C3%B3rio%20final.pdf");
        expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    });

    it("comentários de tarefa de projeto que a pessoa não vê continuam 403 (regressão)", async () => {
        expect((await servidor.chamar("get", `/tarefas/${TAREFA}/comentarios`, { usuario: deFora })).status).toBe(403);
        expect((await servidor.chamar("post", `/tarefas/${TAREFA}/comentarios`, { usuario: deFora, corpo: { texto: "oi" } })).status).toBe(
            403,
        );
    });

    it("Biblioteca: quem enviou mas não pode alterar o item continua sem excluir (regra só da tarefa)", async () => {
        const item = (await servidor.chamar("post", "/biblioteca", { usuario: colega, corpo: { titulo: "Pesquisa" } })).corpo;
        // Anexo enviado pelo líder (que não pode alterar o item do colega): só dá para montar direto no repositório.
        const anexo = await ctx.factory.criarAnexoRepository().criar(
            new Anexo({
                donoTipo: DonoAnexo.BIBLIOTECA,
                donoCodigo: item.codigo,
                nome: "a.pdf",
                tamanhoBytes: PDF.length,
                enviadoPor: { codigo: lider.codigo, nome: lider.nome },
            }),
        );
        await ctx.factory.criarArmazenamentoAnexos().salvar(anexo.arquivo, PDF);
        expect((await excluir(lider, anexo.codigo)).status).toBe(403);
        expect((await excluir(colega, anexo.codigo)).status).toBe(200);
    });

    it("a lista de tarefas traz quantidadeAnexos (2 na com anexos, 0 nas outras) e o PATCH de status também", async () => {
        const projeto = (await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-time"))!;
        const outra = await criarTarefa(ctx.factory, colega, projeto, "tarefa-dois");
        await enviar(colega, TAREFA, "a.pdf");
        await enviar(colega, TAREFA, "b.pdf");

        const lista = (await servidor.chamar("get", "/tarefas", { usuario: ctx.gerente })).corpo;
        expect(lista.find((t: any) => t.codigo === TAREFA).quantidadeAnexos).toBe(2);
        expect(lista.find((t: any) => t.codigo === outra.codigo).quantidadeAnexos).toBe(0);

        const patch = await servidor.chamar("patch", `/tarefas/${TAREFA}/status`, { usuario: colega, corpo: { status: "andamento" } });
        expect(patch.status).toBe(200);
        expect(patch.corpo.quantidadeAnexos).toBe(2);
    });
});
