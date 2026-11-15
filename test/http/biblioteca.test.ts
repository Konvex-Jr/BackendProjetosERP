import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import Participacao from "../../source/domain/entity/Participacao";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto } from "../fixtures";
import { subirServidor, tokenPara } from "./servidorTeste";

const inicio = new Date("2026-10-01T00:00:00.000Z");
const saida = new Date("2026-10-20T00:00:00.000Z");

/**
 * Sessão 17: Biblioteca. Item invisível responde 404 em todo caminho (lista, ficha, anexos,
 * filtro de projeto); sem permissão para alterar responde 403.
 */
describe("Biblioteca", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let bruno: Usuario;
    const PDF = Buffer.from("%PDF-1.4 conteúdo de teste");

    const novo = (usuario: Usuario, corpo: Record<string, unknown>) => servidor.chamar("post", "/biblioteca", { usuario, corpo });
    const editar = (usuario: Usuario, codigo: string, corpo: Record<string, unknown>) =>
        servidor.chamar("put", `/biblioteca/${codigo}`, { usuario, corpo });
    const ver = (usuario: Usuario, codigo: string) => servidor.chamar("get", `/biblioteca/${codigo}`, { usuario });
    const listar = async (usuario: Usuario, query = "") =>
        (await servidor.chamar("get", `/biblioteca${query}`, { usuario })).corpo.map((i: any) => i.titulo).sort();
    const enviar = async (usuario: Usuario, codigo: string, nome = "a.pdf") => {
        const r = await fetch(`${servidor.base}/biblioteca/${codigo}/anexos`, {
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
                "X-Nome-Arquivo": encodeURIComponent(nome),
                "access-token": tokenPara(usuario),
            },
            body: new Uint8Array(PDF),
        });
        const texto = await r.text();
        return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
    };
    const baixar = async (usuario: Usuario, codigo: string) => {
        const r = await fetch(`${servidor.base}/anexos/${codigo}`, { headers: { "access-token": tokenPara(usuario) } });
        return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()) };
    };

    beforeEach(async () => {
        ctx = await criarContexto();
        bruno = new Usuario("Bruno", "bruno@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-bruno");
        await ctx.factory.criarUsuarioRepository().criar(bruno);
        const projetos = ctx.factory.criarProjetoRepository();
        await projetos.criar(new Projeto("Meu", "d", inicio, saida, undefined, [ctx.membro], "proj-meu"));
        await projetos.criar(new Projeto("Alheio", "d", inicio, saida, undefined, [bruno], "proj-alheio"));
        // Ana participou do projeto antigo e saiu.
        await projetos.criar(
            new Projeto(
                "Antigo",
                "d",
                inicio,
                saida,
                undefined,
                [new Participacao(ctx.membro, { dataEntrada: inicio, dataSaida: saida })],
                "proj-antigo",
            ),
        );
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("membro cria item só com título: sigilo todos, autor e podeAlterar", async () => {
        const r = await novo(ctx.membro, { titulo: "Pesquisa" });
        expect(r.status).toBe(200);
        expect(r.corpo).toMatchObject({
            titulo: "Pesquisa",
            conteudo: "",
            links: [],
            tags: [],
            projeto: null,
            sigilo: "todos",
            autor: { codigo: "usr-ana", nome: "Ana Silva" },
            podeAlterar: true,
            anexos: [],
        });
        expect(r.corpo.codigo).toBeTruthy();
        expect(r.corpo.criadoEm).toBeTruthy();
        expect(r.corpo.atualizadoEm).toBeTruthy();
    });

    it("aceita tags e links como texto separado por vírgulas e liga o projeto", async () => {
        const r = await novo(ctx.membro, {
            titulo: "Com tudo",
            conteudo: "## Achados",
            tags: "Mercado, #delivery, mercado",
            links: "https://a.com, https://b.com",
            codigoProjeto: "proj-meu",
            sigilo: "projeto",
        });
        expect(r.status).toBe(200);
        expect(r.corpo.tags).toEqual(["mercado", "delivery"]);
        expect(r.corpo.links).toEqual(["https://a.com", "https://b.com"]);
        expect(r.corpo.projeto).toEqual({ codigo: "proj-meu", nome: "Meu" });
        expect(r.corpo.sigilo).toBe("projeto");
    });

    it("membro não usa sigilo gestao nem projeto alheio; projeto de que saiu pode", async () => {
        expect((await novo(ctx.membro, { titulo: "X", sigilo: "gestao" })).status).toBe(403);
        expect((await novo(ctx.membro, { titulo: "X", codigoProjeto: "proj-alheio" })).status).toBe(403);
        // Projeto inexistente para membro: mesma resposta do projeto alheio (não revela se existe).
        expect((await novo(ctx.membro, { titulo: "X", codigoProjeto: "proj-nao-existe" })).status).toBe(403);
        const antigo = await novo(ctx.membro, { titulo: "X", codigoProjeto: "proj-antigo" });
        expect(antigo.status).toBe(200);
        expect(antigo.corpo.projeto).toEqual({ codigo: "proj-antigo", nome: "Antigo" });
        expect((await novo(ctx.gerente, { titulo: "X", codigoProjeto: "proj-nao-existe" })).status).toBe(404);
        expect((await novo(ctx.membro, { titulo: "X", sigilo: "secreto" })).status).toBe(400);
        expect((await novo(ctx.membro, { titulo: "" })).status).toBe(400);
    });

    it("item gestao do gerente: Bruno não vê na lista, ficha 404, PUT/DELETE/anexo 404", async () => {
        const item = (await novo(ctx.gerente, { titulo: "Plano da gestão", sigilo: "gestao" })).corpo;
        expect(item.sigilo).toBe("gestao");
        expect(await listar(bruno)).toEqual([]);
        expect(await listar(ctx.gerente)).toEqual(["Plano da gestão"]);
        expect((await ver(bruno, item.codigo)).status).toBe(404);
        expect((await ver(bruno, "nao-existe")).status).toBe((await ver(bruno, item.codigo)).status);
        expect((await editar(bruno, item.codigo, { titulo: "Hack" })).status).toBe(404);
        expect((await servidor.chamar("delete", `/biblioteca/${item.codigo}`, { usuario: bruno })).status).toBe(404);
        expect((await enviar(bruno, item.codigo)).status).toBe(404);
        expect((await ver(ctx.gerente, item.codigo)).corpo.titulo).toBe("Plano da gestão");
    });

    it("(Review 1) anexo de item gestao: Bruno pede download/exclusão e recebe 404", async () => {
        const item = (await novo(ctx.gerente, { titulo: "Plano", sigilo: "gestao" })).corpo;
        const anexo = await enviar(ctx.gerente, item.codigo, "plano.pdf");
        expect(anexo.status).toBe(200);
        const negado = await baixar(bruno, anexo.corpo.codigo);
        expect(negado.status).toBe(404);
        expect(negado.bytes.includes(PDF)).toBe(false);
        expect((await servidor.chamar("delete", `/anexos/${anexo.corpo.codigo}`, { usuario: bruno })).status).toBe(404);
        const ok = await baixar(ctx.gerente, anexo.corpo.codigo);
        expect(ok.status).toBe(200);
        expect(ok.bytes.equals(PDF)).toBe(true);
    });

    it("(Review 2) autora não escala sigilo nem projeto alheio no PUT", async () => {
        const item = (await novo(ctx.membro, { titulo: "Meu item" })).corpo;
        expect((await editar(ctx.membro, item.codigo, { titulo: "Meu item", sigilo: "gestao" })).status).toBe(403);
        expect((await ver(ctx.membro, item.codigo)).corpo.sigilo).toBe("todos");
        expect((await editar(ctx.membro, item.codigo, { titulo: "Meu item", codigoProjeto: "proj-alheio" })).status).toBe(403);
        const depois = (await ver(ctx.membro, item.codigo)).corpo;
        expect(depois.projeto).toBeNull();
        expect(depois.sigilo).toBe("todos");
    });

    it("(Review 3) ex-participante lê, edita sem mudar sigilo e anexa no item do projeto antigo", async () => {
        const item = (await novo(ctx.membro, { titulo: "Retro", sigilo: "projeto", codigoProjeto: "proj-antigo" })).corpo;
        expect(item.sigilo).toBe("projeto");
        expect((await ver(ctx.membro, item.codigo)).status).toBe(200);
        const editado = await editar(ctx.membro, item.codigo, { titulo: "Retrospectiva" });
        expect(editado.status).toBe(200);
        expect(editado.corpo).toMatchObject({ titulo: "Retrospectiva", sigilo: "projeto", projeto: { codigo: "proj-antigo" } });
        // Mandando sigilo e projeto iguais aos atuais também passa.
        const igual = await editar(ctx.membro, item.codigo, { titulo: "Retro 2", sigilo: "projeto", codigoProjeto: "proj-antigo" });
        expect(igual.status).toBe(200);
        expect((await enviar(ctx.membro, item.codigo)).status).toBe(200);
        expect((await ver(ctx.membro, item.codigo)).corpo.anexos).toHaveLength(1);
        // Bruno nunca participou do projeto antigo.
        expect((await ver(bruno, item.codigo)).status).toBe(404);
    });

    it("regra de sigilo/projeto só roda quando mudam: autora mantém projeto alheio ligado pela gestão", async () => {
        const item = (await novo(ctx.membro, { titulo: "Da Ana" })).corpo;
        expect((await editar(ctx.gerente, item.codigo, { codigoProjeto: "proj-alheio" })).status).toBe(200);
        // Ana não pode usar proj-alheio, mas manda o mesmo valor: a regra não roda.
        const mesmo = await editar(ctx.membro, item.codigo, { titulo: "Da Ana 2", codigoProjeto: "proj-alheio", sigilo: "todos" });
        expect(mesmo.status).toBe(200);
        // Campo ausente mantém o projeto gravado.
        expect((await editar(ctx.membro, item.codigo, { titulo: "Da Ana 3" })).status).toBe(200);
        const visto = (await ver(ctx.gerente, item.codigo)).corpo;
        expect(visto.titulo).toBe("Da Ana 3");
        expect(visto.projeto).toEqual({ codigo: "proj-alheio", nome: "Alheio" });
        // Mudar o sigilo com o projeto alheio ligado: a regra roda e recusa.
        expect((await editar(ctx.membro, item.codigo, { sigilo: "projeto" })).status).toBe(403);
        expect((await ver(ctx.gerente, item.codigo)).corpo.sigilo).toBe("todos");
    });

    it("(Ruling 8) projeto que a pessoa não vê sai como null e o filtro por ele volta vazio", async () => {
        const item = (await novo(ctx.gerente, { titulo: "Ligado ao alheio", codigoProjeto: "proj-alheio" })).corpo;
        expect(item.projeto).toEqual({ codigo: "proj-alheio", nome: "Alheio" });
        const lista = (await servidor.chamar("get", "/biblioteca", { usuario: ctx.membro })).corpo;
        expect(lista.map((i: any) => [i.titulo, i.projeto])).toEqual([["Ligado ao alheio", null]]);
        expect((await ver(ctx.membro, item.codigo)).corpo.projeto).toBeNull();
        expect(await listar(ctx.membro, "?projeto=proj-alheio")).toEqual([]);
        expect((await ver(bruno, item.codigo)).corpo.projeto).toEqual({ codigo: "proj-alheio", nome: "Alheio" });
        expect(await listar(bruno, "?projeto=proj-alheio")).toEqual(["Ligado ao alheio"]);
        // Projeto de que Ana saiu continua visível para ela.
        const antigo = (await novo(ctx.membro, { titulo: "Antigo", codigoProjeto: "proj-antigo" })).corpo;
        expect(antigo.projeto).toEqual({ codigo: "proj-antigo", nome: "Antigo" });
        // Resposta de edição também esconde.
        const daAna = (await novo(ctx.membro, { titulo: "Da Ana" })).corpo;
        await editar(ctx.gerente, daAna.codigo, { codigoProjeto: "proj-alheio" });
        const editado = await editar(ctx.membro, daAna.codigo, { titulo: "Da Ana editado" });
        expect(editado.status).toBe(200);
        expect(editado.corpo.projeto).toBeNull();
        expect((await ver(ctx.gerente, daAna.codigo)).corpo.projeto).toEqual({ codigo: "proj-alheio", nome: "Alheio" });
    });

    it("(Review 4) filtro de projeto devolve só os itens que a pessoa vê", async () => {
        await novo(ctx.membro, { titulo: "Todos do meu", codigoProjeto: "proj-meu" });
        await novo(ctx.membro, { titulo: "Projeto do meu", sigilo: "projeto", codigoProjeto: "proj-meu" });
        await novo(ctx.gerente, { titulo: "Gestão do meu", sigilo: "gestao", codigoProjeto: "proj-meu" });
        await novo(ctx.gerente, { titulo: "Projeto alheio", sigilo: "projeto", codigoProjeto: "proj-alheio" });
        await novo(ctx.membro, { titulo: "Solto" });
        expect(await listar(ctx.membro, "?projeto=proj-meu")).toEqual(["Projeto do meu", "Todos do meu"]);
        expect(await listar(ctx.membro, "?projeto=proj-alheio")).toEqual([]);
        expect(await listar(ctx.membro)).toEqual(["Projeto do meu", "Solto", "Todos do meu"]);
        expect(await listar(ctx.gerente, "?projeto=proj-meu")).toEqual(["Gestão do meu", "Projeto do meu", "Todos do meu"]);
        expect(await listar(bruno, "?projeto=proj-alheio")).toEqual(["Projeto alheio"]);
        expect(await listar(ctx.gerente, "?sigilo=gestao")).toEqual(["Gestão do meu"]);
        expect(await listar(ctx.membro, "?sigilo=gestao")).toEqual([]);
        expect(await listar(ctx.membro, "?autor=usr-joao")).toEqual([]);
        expect(await listar(ctx.gerente, "?autor=usr-joao")).toEqual(["Gestão do meu", "Projeto alheio"]);
    });

    it("outro membro não edita; gerente edita; Ana exclui (204) e o anexo some", async () => {
        const item = (await novo(ctx.membro, { titulo: "Item da Ana" })).corpo;
        expect((await ver(bruno, item.codigo)).corpo.podeAlterar).toBe(false);
        expect((await editar(bruno, item.codigo, { titulo: "Do Bruno" })).status).toBe(403);
        expect((await servidor.chamar("delete", `/biblioteca/${item.codigo}`, { usuario: bruno })).status).toBe(403);
        expect((await enviar(bruno, item.codigo)).status).toBe(403);
        const doGerente = await editar(ctx.gerente, item.codigo, { titulo: "Revisado" });
        expect(doGerente.status).toBe(200);
        expect(doGerente.corpo.autor.codigo).toBe("usr-ana");

        const anexo = (await enviar(ctx.membro, item.codigo)).corpo;
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(1);
        const excluido = await servidor.chamar("delete", `/biblioteca/${item.codigo}`, { usuario: ctx.membro });
        expect(excluido.status).toBe(204);
        expect(ctx.factory.armazenamentoAnexos.arquivos.size).toBe(0);
        expect((await ver(ctx.membro, item.codigo)).status).toBe(404);
        expect((await baixar(ctx.membro, anexo.codigo)).status).toBe(404);
    });

    it("busca por texto e por tag", async () => {
        await novo(ctx.membro, { titulo: "Concorrentes", conteudo: "O iFood domina", tags: ["delivery"] });
        await novo(ctx.membro, { titulo: "Onboarding", tags: ["pessoas"] });
        expect(await listar(bruno, "?q=IFOOD")).toEqual(["Concorrentes"]);
        expect(await listar(bruno, "?tag=delivery")).toEqual(["Concorrentes"]);
        expect(await listar(bruno, "?tag=%23Delivery")).toEqual(["Concorrentes"]);
        expect(await listar(bruno)).toEqual(["Concorrentes", "Onboarding"]);
    });

    it("exige login", async () => {
        expect((await servidor.chamar("get", "/biblioteca")).status).toBe(401);
        expect((await servidor.chamar("post", "/biblioteca", { corpo: { titulo: "X" } })).status).toBe(401);
    });
});
