import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor, tokenPara } from "./servidorTeste";
import { Papel, comPapel } from "../papel";

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
        const novo = async (nome: string, perfil: Papel, codigo: string) => {
            const u = comPapel(new Usuario(nome, `${codigo}@konvex.com.br`, true, "x", ctx.senioridade, codigo), perfil);
            await usuarios.criar(u);
            return u;
        };
        equipe = ctx.membro;
        criadorFora = await novo("Lia", "membro", "usr-lia");
        fora = await novo("Fê", "membro", "usr-fe");
        gerenteFora = await novo("Gui", "gerenteDaArea", "usr-gui");
        diretor = await novo("Dora", "diretor", "usr-dora");
        const projetos = ctx.factory.criarProjetoRepository();
        await projetos.criar(
            new Projeto("Sigiloso", "d", dataInicio, dataFim, undefined, [equipe], "proj-sig", { criadoPor: criadorFora.codigo }),
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

    it("quem não abre o projeto (gerente de outra área, membro de fora): vê o item 'todos', não o da equipe", async () => {
        for (const u of [gerenteFora, fora]) {
            expect(await titulos(u)).toEqual(["Aberto no sigiloso", "Normal"]);
            expect((await ver(u, itemTodos.codigo)).status).toBe(200);
            expect((await ver(u, itemProjeto.codigo)).status).toBe(404);
            expect(await baixar(u, codigoAnexo)).toBe(200);
        }
    });

    it("filtrar pelo projeto que não abre devolve vazio", async () => {
        expect(await titulos(gerenteFora, "?projeto=proj-sig")).toEqual([]);
    });

    it("equipe e diretor veem os itens e baixam", async () => {
        for (const u of [equipe, diretor]) {
            expect(await titulos(u)).toEqual(["Aberto no sigiloso", "Da equipe", "Normal"]);
            expect((await ver(u, itemTodos.codigo)).status).toBe(200);
            expect(await baixar(u, codigoAnexo)).toBe(200);
        }
    });

    it("quem só criou o projeto (fora da equipe) não vê o item da equipe (sessão 27a)", async () => {
        expect(await titulos(criadorFora)).toEqual(["Aberto no sigiloso", "Normal"]);
        expect((await ver(criadorFora, itemProjeto.codigo)).status).toBe(404);
    });

    it("projeto do item aparece como null para quem não vê o projeto", async () => {
        const r = await servidor.chamar("get", "/biblioteca", { usuario: gerenteFora });
        expect(r.corpo.every((i: any) => i.projeto?.codigo !== "proj-sig")).toBe(true);
    });

    it("gerente com biblioteca.gerir não liga item a projeto que não abre (403); ao que abre, liga", async () => {
        const r = await servidor.chamar("post", "/biblioteca", {
            usuario: gerenteFora,
            corpo: { titulo: "Tentativa", sigilo: "todos", codigoProjeto: "proj-sig" },
        });
        expect(r.status).toBe(403);
        const ok = await servidor.chamar("post", "/biblioteca", {
            usuario: gerenteFora,
            corpo: { titulo: "Normal 2", sigilo: "todos", codigoProjeto: "proj-nor" },
        });
        expect(ok.status).toBe(403);
        const doDiretor = await servidor.chamar("post", "/biblioteca", {
            usuario: diretor,
            corpo: { titulo: "Normal 3", sigilo: "todos", codigoProjeto: "proj-nor" },
        });
        expect(doDiretor.status).toBe(200);
    });
});
