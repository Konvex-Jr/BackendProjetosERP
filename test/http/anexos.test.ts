import Usuario from "../../source/domain/Entity/Usuario";
import Area from "../../source/domain/Entity/Area";
import PerfilUsuario from "../../source/domain/Enum/PerfilUsuario";
import { LIMITE_ANEXO_BYTES } from "../../source/domain/Enum/Anexo";
import { criarContexto } from "../fixtures";
import { subirServidor, tokenPara } from "./servidorTeste";

/**
 * Sessão 12c (09/11/2026): anexos reais em documentos de pasta, itens da Base e iniciativas.
 * Até 20 MB, documentos e imagens; cada anexo segue as regras de leitura e alteração do dono.
 */
describe("Anexos", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let bruno: Usuario;
    let carla: Usuario;
    const PDF = Buffer.from("%PDF-1.4 conteúdo de teste");

    const enviar = async (usuario: Usuario | null, caminho: string, nome: string, conteudo: Buffer = PDF) => {
        const headers: Record<string, string> = { "Content-Type": "application/octet-stream", "X-Nome-Arquivo": encodeURIComponent(nome) };
        if (usuario) headers["access-token"] = tokenPara(usuario);
        const r = await fetch(servidor.base + caminho, { method: "POST", headers, body: new Uint8Array(conteudo) });
        const texto = await r.text();
        return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
    };
    const baixar = async (usuario: Usuario, codigo: string) => {
        const r = await fetch(`${servidor.base}/anexos/${codigo}`, { headers: { "access-token": tokenPara(usuario) } });
        return { status: r.status, headers: r.headers, bytes: Buffer.from(await r.arrayBuffer()) };
    };
    const itemBase = async (usuario: Usuario) =>
        (await servidor.chamar("post", "/conhecimento", { usuario, corpo: { titulo: "Pesquisa", categoria: "pesquisa", resumo: "r" } })).corpo;

    beforeEach(async () => {
        ctx = await criarContexto();
        await ctx.factory.criarAreaRepository().criar(new Area("Inovação", null, true, "area-inov"));
        bruno = new Usuario("Bruno", "bruno@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-bruno");
        carla = new Usuario("Carla", "carla@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-carla", {
            area: (await ctx.factory.criarAreaRepository().buscarPorCodigo("area-inov"))!,
        });
        for (const u of [bruno, carla]) await ctx.factory.criarUsuarioRepository().criar(u);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("informa o limite e os tipos aceitos", async () => {
        const r = await servidor.chamar("get", "/anexos/regras", { usuario: bruno });
        expect(r.corpo.limiteBytes).toBe(20 * 1024 * 1024);
        expect(r.corpo.extensoes).toEqual(expect.arrayContaining(["pdf", "docx", "xlsx", "png", "jpg", "zip"]));
    });

    it("membro anexa um PDF ao próprio item da Base e outro membro baixa", async () => {
        const item = await itemBase(ctx.membro);
        const r = await enviar(ctx.membro, `/conhecimento/${item.codigo}/anexos`, "Relatório de mercado.pdf");
        expect(r.status).toBe(200);
        expect(r.corpo).toMatchObject({ nome: "Relatório de mercado.pdf", tipoMime: "application/pdf", tamanhoBytes: PDF.length });
        expect(r.corpo.enviadoPor.codigo).toBe(ctx.membro.codigo);
        expect(r.corpo.arquivo).toBeUndefined(); // nome no disco não sai da API

        const ficha = await servidor.chamar("get", `/conhecimento/${item.codigo}`, { usuario: bruno });
        expect(ficha.corpo.anexos.map((a: any) => a.nome)).toEqual(["Relatório de mercado.pdf"]);

        const download = await baixar(bruno, r.corpo.codigo);
        expect(download.status).toBe(200);
        expect(download.bytes.equals(PDF)).toBe(true);
        expect(download.headers.get("content-type")).toBe("application/pdf");
        expect(download.headers.get("x-content-type-options")).toBe("nosniff");
        expect(download.headers.get("content-disposition")).toContain("Relat%C3%B3rio%20de%20mercado.pdf");
    });

    it("só quem pode alterar o item anexa e exclui", async () => {
        const item = await itemBase(ctx.membro);
        const negado = await enviar(bruno, `/conhecimento/${item.codigo}/anexos`, "a.pdf");
        expect(negado.status).toBe(403);
        expect(negado.corpo.message).toBe("Só quem cadastrou o item ou a gestão pode alterá-lo ou excluí-lo.");

        const anexo = (await enviar(ctx.gerente, `/conhecimento/${item.codigo}/anexos`, "a.pdf")).corpo;
        expect((await servidor.chamar("delete", `/anexos/${anexo.codigo}`, { usuario: bruno })).status).toBe(403);
        expect((await servidor.chamar("delete", `/anexos/${anexo.codigo}`, { usuario: ctx.membro })).status).toBe(200);
        expect((await baixar(bruno, anexo.codigo)).status).toBe(404);
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
    });

    it("recusa tipo não aceito, arquivo vazio, acima de 20 MB e sem login", async () => {
        const item = await itemBase(ctx.membro);
        const caminho = `/conhecimento/${item.codigo}/anexos`;
        const html = await enviar(ctx.membro, caminho, "pagina.html");
        expect(html.status).toBe(400);
        expect(html.corpo.codigo).toBe("TIPO_ANEXO_NAO_ACEITO");
        expect((await enviar(ctx.membro, caminho, "semextensao")).corpo.codigo).toBe("TIPO_ANEXO_NAO_ACEITO");
        expect((await enviar(ctx.membro, caminho, "vazio.pdf", Buffer.alloc(0))).corpo.codigo).toBe("ANEXO_VAZIO");
        const grande = await enviar(ctx.membro, caminho, "grande.pdf", Buffer.alloc(LIMITE_ANEXO_BYTES + 1));
        expect(grande.status).toBe(400);
        expect(grande.corpo.message).toBe("O arquivo passa de 20 MB, o tamanho máximo.");
        const muitoGrande = await enviar(ctx.membro, caminho, "enorme.pdf", Buffer.alloc(LIMITE_ANEXO_BYTES + 5000));
        expect(muitoGrande.status).toBe(413);
        expect(muitoGrande.corpo.codigo).toBe("ANEXO_GRANDE_DEMAIS");
        expect((await enviar(null, caminho, "a.pdf")).status).toBe(401);
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
    });

    it("nome com caminho fica só com o nome do arquivo", async () => {
        const item = await itemBase(ctx.membro);
        const r = await enviar(ctx.membro, `/conhecimento/${item.codigo}/anexos`, "../../etc/foto.PNG");
        expect(r.corpo.nome).toBe("foto.PNG");
        expect(r.corpo.tipoMime).toBe("image/png");
    });

    it("excluir o item da Base apaga os anexos e os arquivos", async () => {
        const item = await itemBase(ctx.membro);
        const anexo = (await enviar(ctx.membro, `/conhecimento/${item.codigo}/anexos`, "a.pdf")).corpo;
        await servidor.chamar("delete", `/conhecimento/${item.codigo}`, { usuario: ctx.membro });
        expect((await baixar(ctx.gerente, anexo.codigo)).status).toBe(404);
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
    });

    it("iniciativa: responsável anexa, todos baixam, membro comum não anexa; excluir leva os arquivos", async () => {
        const ini = (await servidor.chamar("post", "/iniciativas", { usuario: carla, corpo: { titulo: "Chatbot", tipo: "produto", frente: "lab" } })).corpo;
        expect((await enviar(bruno, `/iniciativas/${ini.codigo}/anexos`, "a.pdf")).status).toBe(403);
        const anexo = (await enviar(carla, `/iniciativas/${ini.codigo}/anexos`, "protótipo.png")).corpo;
        expect(anexo.tipoMime).toBe("image/png");
        expect((await servidor.chamar("get", `/iniciativas/${ini.codigo}`, { usuario: bruno })).corpo.anexos).toHaveLength(1);
        expect((await servidor.chamar("get", "/iniciativas", { usuario: bruno })).corpo[0].anexos).toHaveLength(1);
        expect((await baixar(bruno, anexo.codigo)).status).toBe(200);
        await servidor.chamar("delete", `/iniciativas/${ini.codigo}`, { usuario: carla });
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
    });

    it("documento do tipo arquivo: gestão envia; sigilo da pasta vale para baixar", async () => {
        const publica = (await servidor.chamar("post", "/pastas", { usuario: ctx.gerente, corpo: { nome: "Modelos" } })).corpo;
        const gestao = (await servidor.chamar("post", "/pastas", { usuario: ctx.gerente, corpo: { nome: "Financeiro", sigilo: "gestao" } })).corpo;

        expect((await enviar(ctx.membro, `/pastas/${publica.codigo}/documentos/arquivo`, "a.pdf")).status).toBe(403);

        const doc = await enviar(ctx.gerente, `/pastas/${publica.codigo}/documentos/arquivo`, "Modelo de proposta.docx");
        expect(doc.status).toBe(200);
        expect(doc.corpo).toMatchObject({ nome: "Modelo de proposta", arquivoUrl: null, extensao: "DOCX" });
        expect(doc.corpo.anexo.nome).toBe("Modelo de proposta.docx");
        const sigiloso = (await enviar(ctx.gerente, `/pastas/${gestao.codigo}/documentos/arquivo?nome=Balanço`, "balanco.xlsx")).corpo;
        expect(sigiloso.nome).toBe("Balanço");

        const lista = (await servidor.chamar("get", `/pastas/${publica.codigo}/documentos`, { usuario: ctx.membro })).corpo;
        expect(lista[0].anexo.codigo).toBe(doc.corpo.anexo.codigo);
        expect((await baixar(ctx.membro, doc.corpo.anexo.codigo)).status).toBe(200);
        expect((await baixar(ctx.membro, sigiloso.anexo.codigo)).status).toBe(404);
        expect((await baixar(ctx.gerente, sigiloso.anexo.codigo)).status).toBe(200);
        expect((await servidor.chamar("delete", `/anexos/${sigiloso.anexo.codigo}`, { usuario: ctx.membro })).status).toBe(404);
    });

    it("documento de arquivo não vira link; links continuam; excluir documento ou pasta apaga o arquivo", async () => {
        const pasta = (await servidor.chamar("post", "/pastas", { usuario: ctx.gerente, corpo: { nome: "Modelos" } })).corpo;
        const link = await servidor.chamar("post", `/pastas/${pasta.codigo}/documentos`, { usuario: ctx.gerente, corpo: { nome: "Drive", arquivoUrl: "https://drive.google.com/x" } });
        expect(link.status).toBe(200);
        const doc = (await enviar(ctx.gerente, `/pastas/${pasta.codigo}/documentos/arquivo`, "a.pdf")).corpo;

        const trocar = await servidor.chamar("put", `/documentos/${doc.codigo}`, { usuario: ctx.gerente, corpo: { nome: "a", arquivoUrl: "https://x.com" } });
        expect(trocar.status).toBe(400);
        expect(trocar.corpo.codigo).toBe("DOCUMENTO_E_ARQUIVO");
        const renomear = await servidor.chamar("put", `/documentos/${doc.codigo}`, { usuario: ctx.gerente, corpo: { nome: "Ata final" } });
        expect(renomear.corpo).toMatchObject({ nome: "Ata final", arquivoUrl: null });
        expect(renomear.corpo.anexo.codigo).toBe(doc.anexo.codigo);

        await servidor.chamar("delete", `/documentos/${doc.codigo}`, { usuario: ctx.gerente });
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);

        await enviar(ctx.gerente, `/pastas/${pasta.codigo}/documentos/arquivo`, "b.pdf");
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(1);
        await servidor.chamar("delete", `/pastas/${pasta.codigo}`, { usuario: ctx.gerente });
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
    });
});

describe("Anexos ao excluir projeto", () => {
    it("excluir o projeto apaga os arquivos das pastas da equipe", async () => {
        const Projeto = (await import("../../source/domain/Entity/Projeto")).default;
        const { dataInicio, dataFim } = await import("../fixtures");
        const ctx = await criarContexto();
        const diretor = new Usuario("Dora", "dora@konvex.com.br", PerfilUsuario.DIRETOR, true, "x", ctx.senioridade, "usr-dora");
        await ctx.factory.criarUsuarioRepository().criar(diretor);
        await ctx.factory.criarProjetoRepository().criar(new Projeto("App", "d", dataInicio, dataFim, undefined, [ctx.membro], "proj-app"));
        const servidor = await subirServidor(ctx.factory);
        try {
            const pasta = (await servidor.chamar("post", "/pastas", { usuario: diretor, corpo: { nome: "Entregas", sigilo: "projeto", codigoProjeto: "proj-app" } })).corpo;
            const r = await fetch(`${servidor.base}/pastas/${pasta.codigo}/documentos/arquivo`, {
                method: "POST",
                headers: { "access-token": tokenPara(diretor), "X-Nome-Arquivo": "a.pdf" },
                body: new Uint8Array(Buffer.from("pdf")),
            });
            expect(r.status).toBe(200);
            expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(1);
            expect((await servidor.chamar("delete", "/projetos/proj-app", { usuario: diretor })).status).toBe(200);
            expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
        } finally {
            await servidor.fechar();
        }
    });
});
