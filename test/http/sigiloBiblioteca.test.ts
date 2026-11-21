import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor, tokenPara } from "./servidorTeste";

/** Sessão 20 (regra da 27a): itens da Biblioteca ligados a projeto sigiloso só aparecem para quem vê o projeto. */
describe("Biblioteca e projeto sigiloso", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let equipe: Usuario;
    let criadorFora: Usuario; // criou o sigiloso, mas não está na equipe
    let fora: Usuario;
    let gerenteFora: Usuario;
    let diretor: Usuario;
    let itemTodos: any;
    let itemProjeto: any;
    let codigoAnexo: string;
    const PDF = Buffer.from("%PDF-1.4 conteúdo de teste");

    const titulos = async (usuario: Usuario, query = "") =>
        (await servidor.chamar("get", `/biblioteca${query}`, { usuario })).corpo.map((i: any) => i.titulo).sort();
    const ver = (usuario: Usuario, codigo: string) => servidor.chamar("get", `/biblioteca/${codigo}`, { usuario });
    const baixar = async (usuario: Usuario, codigo: string) =>
        (await fetch(`${servidor.base}/anexos/${codigo}`, { headers: { "access-token": tokenPara(usuario) } })).status;

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const novo = async (nome: string, perfil: PerfilUsuario, codigo: string) => {
            const u = new Usuario(nome, `${codigo}@konvex.com.br`, perfil, true, "x", ctx.senioridade, codigo);
            await usuarios.criar(u);
            return u;
        };
        equipe = ctx.membro;
        criadorFora = await novo("Lia", PerfilUsuario.MEMBRO, "usr-lia");
        fora = await novo("Fê", PerfilUsuario.MEMBRO, "usr-fe");
        gerenteFora = await novo("Gui", PerfilUsuario.GERENTE, "usr-gui");
        diretor = await novo("Dora", PerfilUsuario.DIRETOR, "usr-dora");
        const projetos = ctx.factory.criarProjetoRepository();
        await projetos.criar(
            new Projeto("Sigiloso", "d", dataInicio, dataFim, undefined, [equipe], "proj-sig", {
                sigiloso: true,
                criadoPor: criadorFora.codigo,
            }),
        );
        await projetos.criar(new Projeto("Normal", "d", dataInicio, dataFim, undefined, [equipe], "proj-nor"));
        servidor = await subirServidor(ctx.factory);
        const criar = async (corpo: Record<string, unknown>) =>
            (await servidor.chamar("post", "/biblioteca", { usuario: diretor, corpo })).corpo;
        itemTodos = await criar({ titulo: "Aberto no sigiloso", sigilo: "todos", codigoProjeto: "proj-sig" });
        itemProjeto = await criar({ titulo: "Da equipe", sigilo: "projeto", codigoProjeto: "proj-sig" });
        await criar({ titulo: "Normal", sigilo: "todos", codigoProjeto: "proj-nor" });
        const r = await fetch(`${servidor.base}/biblioteca/${itemTodos.codigo}/anexos`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream", "X-Nome-Arquivo": "a.pdf", "access-token": tokenPara(diretor) },
            body: new Uint8Array(PDF),
        });
        codigoAnexo = (await r.json()).codigo;
    });

    afterEach(async () => servidor.fechar());

    it("gerente fora do sigiloso não lista, não abre e não baixa o anexo de item do projeto", async () => {
        expect(await titulos(gerenteFora)).toEqual(["Normal"]);
        expect((await ver(gerenteFora, itemTodos.codigo)).status).toBe(404);
        expect((await ver(gerenteFora, itemProjeto.codigo)).status).toBe(404);
        expect(await baixar(gerenteFora, codigoAnexo)).toBe(404);
    });

    it("membro sem relação também não vê, nem baixa", async () => {
        expect(await titulos(fora)).toEqual(["Normal"]);
        expect((await ver(fora, itemTodos.codigo)).status).toBe(404);
        expect(await baixar(fora, codigoAnexo)).toBe(404);
    });

    it("filtrar pelo sigiloso devolve vazio para o gerente fora", async () => {
        expect(await titulos(gerenteFora, "?projeto=proj-sig")).toEqual([]);
    });

    it("equipe e diretor veem os itens e baixam", async () => {
        for (const u of [equipe, diretor]) {
            expect(await titulos(u)).toEqual(["Aberto no sigiloso", "Da equipe", "Normal"]);
            expect((await ver(u, itemTodos.codigo)).status).toBe(200);
            expect(await baixar(u, codigoAnexo)).toBe(200);
        }
    });

    it("quem só criou o sigiloso (fora da equipe) não vê os itens nem baixa (sessão 27a)", async () => {
        expect(await titulos(criadorFora)).toEqual(["Normal"]);
        expect((await ver(criadorFora, itemTodos.codigo)).status).toBe(404);
        expect((await ver(criadorFora, itemProjeto.codigo)).status).toBe(404);
        expect(await baixar(criadorFora, codigoAnexo)).toBe(404);
        expect((await ver(fora, itemProjeto.codigo)).status).toBe(404);
    });

    it("projeto do item aparece como null para quem não vê o projeto", async () => {
        const r = await servidor.chamar("get", "/biblioteca", { usuario: gerenteFora });
        expect(r.corpo.every((i: any) => i.projeto?.codigo !== "proj-sig")).toBe(true);
    });

    it("gerente com biblioteca.gerir fora da equipe não liga item ao sigiloso (403)", async () => {
        const r = await servidor.chamar("post", "/biblioteca", {
            usuario: gerenteFora,
            corpo: { titulo: "Tentativa", sigilo: "todos", codigoProjeto: "proj-sig" },
        });
        expect(r.status).toBe(403);
        const ok = await servidor.chamar("post", "/biblioteca", {
            usuario: gerenteFora,
            corpo: { titulo: "Normal 2", sigilo: "todos", codigoProjeto: "proj-nor" },
        });
        expect(ok.status).toBe(200);
    });
});
