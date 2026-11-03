import Usuario from "../../source/domain/Entity/Usuario";
import Projeto from "../../source/domain/Entity/Projeto";
import PerfilUsuario from "../../source/domain/Enum/PerfilUsuario";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 9 (03/11/2026): sigilo das pastas (todos / gestao / projeto) e documentos como link. */
describe("Pastas e documentos com sigilo", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let outroMembro: Usuario;
    const pastas: Record<string, string> = {};

    const criarPasta = async (nome: string, sigilo?: string, codigoProjeto?: string) => {
        const r = await servidor.chamar("post", "/pastas", { usuario: ctx.gerente, corpo: { nome, sigilo, codigoProjeto } });
        expect(r.status).toBe(200);
        return r.corpo;
    };
    const nomes = (corpo: any[]) => corpo.map((p) => p.nome).sort();

    beforeEach(async () => {
        ctx = await criarContexto();
        outroMembro = new Usuario("Bruno", "bruno@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-bruno");
        await ctx.factory.criarUsuarioRepository().criar(outroMembro);
        const repo = ctx.factory.criarProjetoRepository();
        await repo.criar(new Projeto("Meu projeto", "d", dataInicio, dataFim, undefined, [ctx.membro], "proj-meu"));
        await repo.criar(new Projeto("Projeto alheio", "d", dataInicio, dataFim, undefined, [outroMembro], "proj-alheio"));
        servidor = await subirServidor(ctx.factory);
        pastas.publica = (await criarPasta("Modelos")).codigo;
        pastas.gestao = (await criarPasta("Financeiro", "gestao")).codigo;
        pastas.meu = (await criarPasta("Entregas do meu", "projeto", "proj-meu")).codigo;
        pastas.alheio = (await criarPasta("Entregas do alheio", "projeto", "proj-alheio")).codigo;
    });

    afterEach(async () => servidor.fechar());

    it("pasta nova sem sigilo é de todos; pasta de projeto devolve o projeto", async () => {
        const lista = (await servidor.chamar("get", "/pastas", { usuario: ctx.gerente })).corpo;
        const publica = lista.find((p: any) => p.codigo === pastas.publica);
        expect(publica.sigilo).toBe("todos");
        expect(publica.projeto).toBeNull();
        expect(lista.find((p: any) => p.codigo === pastas.meu).projeto).toEqual({ codigo: "proj-meu", nome: "Meu projeto" });
    });

    it("gestão vê todas as pastas", async () => {
        const r = await servidor.chamar("get", "/pastas", { usuario: ctx.gerente });
        expect(nomes(r.corpo)).toEqual(["Entregas do alheio", "Entregas do meu", "Financeiro", "Modelos"]);
    });

    it("membro vê as de todos e as dos próprios projetos, nunca as da gestão", async () => {
        const r = await servidor.chamar("get", "/pastas", { usuario: ctx.membro });
        expect(nomes(r.corpo)).toEqual(["Entregas do meu", "Modelos"]);
    });

    it("membro recebe 404 ao abrir documentos de pasta restrita", async () => {
        expect((await servidor.chamar("get", `/pastas/${pastas.gestao}/documentos`, { usuario: ctx.membro })).status).toBe(404);
        expect((await servidor.chamar("get", `/pastas/${pastas.alheio}/documentos`, { usuario: ctx.membro })).status).toBe(404);
        expect((await servidor.chamar("get", `/pastas/${pastas.meu}/documentos`, { usuario: ctx.membro })).status).toBe(200);
        expect((await servidor.chamar("get", `/pastas/${pastas.gestao}/documentos`, { usuario: ctx.gerente })).status).toBe(200);
    });

    it("pasta de projeto exige projeto existente", async () => {
        const sem = await servidor.chamar("post", "/pastas", { usuario: ctx.gerente, corpo: { nome: "X", sigilo: "projeto" } });
        expect(sem.status).toBe(400);
        const inexistente = await servidor.chamar("post", "/pastas", { usuario: ctx.gerente, corpo: { nome: "X", sigilo: "projeto", codigoProjeto: "nao-existe" } });
        expect(inexistente.status).toBe(404);
        const invalido = await servidor.chamar("post", "/pastas", { usuario: ctx.gerente, corpo: { nome: "X", sigilo: "secreto" } });
        expect(invalido.status).toBe(400);
    });

    it("gestão troca o sigilo; renomear sem sigilo mantém o atual", async () => {
        const renomeada = await servidor.chamar("put", `/pastas/${pastas.gestao}`, { usuario: ctx.gerente, corpo: { nome: "Finanças" } });
        expect(renomeada.corpo.sigilo).toBe("gestao");
        await servidor.chamar("put", `/pastas/${pastas.gestao}`, { usuario: ctx.gerente, corpo: { nome: "Finanças", sigilo: "todos" } });
        expect(nomes((await servidor.chamar("get", "/pastas", { usuario: ctx.membro })).corpo)).toContain("Finanças");
    });

    it("membro não cria, edita nem exclui pastas e documentos", async () => {
        expect((await servidor.chamar("post", "/pastas", { usuario: ctx.membro, corpo: { nome: "X" } })).status).toBe(403);
        expect((await servidor.chamar("put", `/pastas/${pastas.publica}`, { usuario: ctx.membro, corpo: { nome: "X" } })).status).toBe(403);
        expect((await servidor.chamar("delete", `/pastas/${pastas.publica}`, { usuario: ctx.membro })).status).toBe(403);
        const doc = await servidor.chamar("post", `/pastas/${pastas.publica}/documentos`, { usuario: ctx.membro, corpo: { nome: "X", arquivoUrl: "https://drive.google.com/x" } });
        expect(doc.status).toBe(403);
    });

    it("documento é link http(s); gestão cadastra, troca o link e exclui", async () => {
        const invalido = await servidor.chamar("post", `/pastas/${pastas.publica}/documentos`, { usuario: ctx.gerente, corpo: { nome: "Ata", arquivoUrl: "javascript:alert(1)" } });
        expect(invalido.status).toBe(400);

        const criado = await servidor.chamar("post", `/pastas/${pastas.publica}/documentos`, { usuario: ctx.gerente, corpo: { nome: "Ata", arquivoUrl: "https://drive.google.com/ata" } });
        expect(criado.status).toBe(200);
        expect(criado.corpo.tamanhoBytes).toBe(0);

        const editado = await servidor.chamar("put", `/documentos/${criado.corpo.codigo}`, { usuario: ctx.gerente, corpo: { nome: "Ata de outubro", arquivoUrl: "https://drive.google.com/ata2" } });
        expect(editado.corpo.arquivoUrl).toBe("https://drive.google.com/ata2");

        const lista = await servidor.chamar("get", `/pastas/${pastas.publica}/documentos`, { usuario: ctx.membro });
        expect(lista.corpo.map((d: any) => d.nome)).toEqual(["Ata de outubro"]);

        expect((await servidor.chamar("delete", `/documentos/${criado.corpo.codigo}`, { usuario: ctx.gerente })).status).toBe(200);
    });

    it("envio de arquivo para o servidor foi retirado", async () => {
        const r = await servidor.chamar("post", `/pastas/${pastas.publica}/documentos/upload`, { usuario: ctx.gerente, corpo: {} });
        expect(r.status).toBe(404);
        expect((await servidor.chamar("get", "/uploads/qualquer.pdf", { usuario: ctx.gerente })).status).toBe(404);
    });
});
