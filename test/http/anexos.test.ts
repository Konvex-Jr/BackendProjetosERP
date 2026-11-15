import Usuario from "../../source/domain/entity/Usuario";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { LIMITE_ANEXO_BYTES } from "../../source/domain/enum/Anexo";
import { criarContexto } from "../fixtures";
import { subirServidor, tokenPara } from "./servidorTeste";

/**
 * Sessão 12c (09/11/2026): anexos reais, até 20 MB, documentos e imagens; cada anexo segue as
 * regras de leitura e alteração do dono. Desde a sessão 17 o dono é um item da Biblioteca
 * (ou uma capacitação, em capacitacoes.test.ts).
 */
describe("Anexos", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let bruno: Usuario;
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
        (await servidor.chamar("post", "/biblioteca", { usuario, corpo: { titulo: "Pesquisa" } })).corpo;

    beforeEach(async () => {
        ctx = await criarContexto();
        bruno = new Usuario("Bruno", "bruno@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-bruno");
        await ctx.factory.criarUsuarioRepository().criar(bruno);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("informa o limite e os tipos aceitos", async () => {
        const r = await servidor.chamar("get", "/anexos/regras", { usuario: bruno });
        expect(r.corpo.limiteBytes).toBe(20 * 1024 * 1024);
        expect(r.corpo.extensoes).toEqual(expect.arrayContaining(["pdf", "docx", "xlsx", "png", "jpg", "zip"]));
    });

    it("membro anexa um PDF ao próprio item da Biblioteca e outro membro baixa", async () => {
        const item = await itemBase(ctx.membro);
        const r = await enviar(ctx.membro, `/biblioteca/${item.codigo}/anexos`, "Relatório de mercado.pdf");
        expect(r.status).toBe(200);
        expect(r.corpo).toMatchObject({ nome: "Relatório de mercado.pdf", tipoMime: "application/pdf", tamanhoBytes: PDF.length });
        expect(r.corpo.enviadoPor.codigo).toBe(ctx.membro.codigo);
        expect(r.corpo.arquivo).toBeUndefined(); // nome no disco não sai da API

        const ficha = await servidor.chamar("get", `/biblioteca/${item.codigo}`, { usuario: bruno });
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
        const negado = await enviar(bruno, `/biblioteca/${item.codigo}/anexos`, "a.pdf");
        expect(negado.status).toBe(403);
        expect(negado.corpo.message).toBe("Só quem cadastrou o item ou a gestão pode alterá-lo ou excluí-lo.");

        const anexo = (await enviar(ctx.gerente, `/biblioteca/${item.codigo}/anexos`, "a.pdf")).corpo;
        expect((await servidor.chamar("delete", `/anexos/${anexo.codigo}`, { usuario: bruno })).status).toBe(403);
        expect((await servidor.chamar("delete", `/anexos/${anexo.codigo}`, { usuario: ctx.membro })).status).toBe(200);
        expect((await baixar(bruno, anexo.codigo)).status).toBe(404);
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
    });

    it("recusa tipo não aceito, arquivo vazio, acima de 20 MB e sem login", async () => {
        const item = await itemBase(ctx.membro);
        const caminho = `/biblioteca/${item.codigo}/anexos`;
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
        const r = await enviar(ctx.membro, `/biblioteca/${item.codigo}/anexos`, "../../etc/foto.PNG");
        expect(r.corpo.nome).toBe("foto.PNG");
        expect(r.corpo.tipoMime).toBe("image/png");
    });

    it("excluir o item da Biblioteca apaga os anexos e os arquivos", async () => {
        const item = await itemBase(ctx.membro);
        const anexo = (await enviar(ctx.membro, `/biblioteca/${item.codigo}/anexos`, "a.pdf")).corpo;
        await servidor.chamar("delete", `/biblioteca/${item.codigo}`, { usuario: ctx.membro });
        expect((await baixar(ctx.gerente, anexo.codigo)).status).toBe(404);
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
    });
});
