import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import StatusPessoa from "../../source/domain/enum/StatusPessoa";
import { criarContexto, dataFim, dataInicio, obrigatoriosDoProjeto } from "../fixtures";
import { subirServidor } from "./servidorTeste";
import { Papel, comPapel } from "../papel";

/** Sessão 21: PUT /projetos/:codigo/colunas e o campo `colunas` do projeto. */
describe("Colunas do projeto", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let diretor: Usuario;
    let lider: Usuario;
    let trainee: Usuario;
    let deFora: Usuario;
    let colunas: { codigo: string; nome: string; cor: string; papel: string }[];

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const novo = async (nome: string, perfil: Papel, codigo: string, status?: StatusPessoa) => {
            const u = comPapel(
                new Usuario(nome, `${codigo}@konvex.com.br`, true, "x", ctx.senioridade, codigo, status ? { status } : {}),
                perfil,
            );
            await usuarios.criar(u);
            return u;
        };
        diretor = await novo("Dora", "diretor", "usr-dora");
        lider = await novo("Lia", "membro", "usr-lia");
        trainee = await novo("Tina", "membro", "usr-tina", StatusPessoa.TRAINEE);
        deFora = await novo("Fábio", "membro", "usr-fabio");
        const projetos = ctx.factory.criarProjetoRepository();
        const normal = await projetos.criar(
            new Projeto("Normal", "d", dataInicio, dataFim, undefined, [ctx.membro, lider, trainee], "proj-nor", { lider }),
        );
        colunas = normal.colunas.map((c) => c.toJSON());
        await projetos.criar(new Projeto("Sigiloso", "d", dataInicio, dataFim, undefined, [ctx.membro], "proj-sig", {}));
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const gravar = (codigo: string, usuario: Usuario, corpo: unknown = { colunas }) =>
        servidor.chamar("put", `/projetos/${codigo}/colunas`, { usuario, corpo });

    it.each([
        ["líder", () => lider],
        ["gerente", () => ctx.gerente],
        ["diretor", () => diretor],
    ])("%s grava as colunas e recebe a lista gravada", async (_nome, quem) => {
        const nova = [...colunas, { nome: "Homologação", cor: "laranja", papel: "meio" }];
        const r = await gravar("proj-nor", quem(), { colunas: nova });
        expect(r.status).toBe(200);
        expect(r.corpo.map((c: any) => c.nome)).toEqual(["A fazer", "Fazendo", "Revisando", "Concluído", "Homologação"]);
        const lido = await servidor.chamar("get", "/projetos/proj-nor", { usuario: ctx.gerente });
        expect(lido.corpo.colunas).toHaveLength(5);
    });

    it("participante, trainee da equipe e membro de fora: 403", async () => {
        expect((await gravar("proj-nor", ctx.membro)).status).toBe(403);
        expect((await gravar("proj-nor", trainee)).status).toBe(403);
        expect((await gravar("proj-nor", deFora)).status).toBe(403);
    });

    it("sem login: 401; projeto que não existe: 404", async () => {
        expect((await servidor.chamar("put", "/projetos/proj-nor/colunas", { corpo: { colunas } })).status).toBe(401);
        expect((await gravar("nao-existe", ctx.gerente)).status).toBe(404);
    });

    it("sigiloso: membro e gerente de fora 403 PROJETO_SEM_ACESSO (sessão 27a; antes o membro tinha 404), diretor 200", async () => {
        comPapel(ctx.gerente, "gerenteDaArea");
        for (const quem of [deFora, ctx.gerente]) {
            const r = await gravar("proj-sig", quem);
            expect(r.status).toBe(403);
            expect(r.corpo.codigo).toBe("PROJETO_SEM_ACESSO");
        }
        const dele = (await servidor.chamar("get", "/projetos/proj-sig", { usuario: diretor })).corpo.colunas;
        expect((await gravar("proj-sig", diretor, { colunas: dele })).status).toBe(200);
    });

    it("entrada inválida: 400 com o código do erro", async () => {
        const r = await gravar("proj-nor", lider, { colunas: "x" });
        expect(r.status).toBe(400);
        expect(r.corpo.code ?? r.corpo.codigo).toBe("COLUNAS_INVALIDAS");
        const duas = await gravar("proj-nor", lider, { colunas: colunas.map((c) => ({ ...c, papel: "entrada" })) });
        expect(duas.status).toBe(400);
        expect(duas.corpo.code ?? duas.corpo.codigo).toBe("COLUNA_ENTRADA_UNICA");
    });

    it("excluir coluna com tarefa sem destino: 400; com destino: 200 e a tarefa muda de coluna", async () => {
        const tarefa = await servidor.chamar("post", "/tarefas", {
            usuario: ctx.gerente,
            corpo: {
                codigoProjeto: "proj-nor",
                titulo: "T",
                dataInicio,
                dataFim,
                status: "andamento",
                codigosResponsaveis: [ctx.membro.codigo],
            },
        });
        expect(tarefa.status).toBe(200);
        await servidor.chamar("patch", `/tarefas/${tarefa.corpo.codigo}/status`, { usuario: ctx.gerente, corpo: { status: "andamento" } });
        const fazendo = colunas[1].codigo;
        const sem = colunas.filter((c) => c.codigo !== fazendo);
        const r = await gravar("proj-nor", lider, { colunas: sem });
        expect(r.status).toBe(400);
        expect(r.corpo.code ?? r.corpo.codigo).toBe("DESTINO_COLUNA_OBRIGATORIO");
        const ok = await gravar("proj-nor", lider, { colunas: sem, destinos: { [fazendo]: colunas[2].codigo } });
        expect(ok.status).toBe(200);
        const lista = await servidor.chamar("get", "/tarefas", { usuario: ctx.gerente });
        const lida = lista.corpo.find((t: any) => t.codigo === tarefa.corpo.codigo);
        expect(lida.coluna.nome).toBe("Revisando");
    });

    it("GET traz colunas na versão completa e não no cartão do sigiloso", async () => {
        const completo = await servidor.chamar("get", "/projetos/proj-nor", { usuario: diretor });
        expect(completo.corpo.colunas).toHaveLength(4);
        const lista = await servidor.chamar("get", "/projetos", { usuario: diretor });
        comPapel(ctx.gerente, "gerenteDaArea");
        expect(lista.corpo.find((p: any) => p.codigo === "proj-nor").colunas).toHaveLength(4);
        const cartao = await servidor.chamar("get", "/projetos/proj-sig", { usuario: ctx.gerente });
        expect(cartao.corpo.cartao).toBe(true);
        expect(cartao.corpo.colunas).toBeUndefined();
        const cartaoLista = (await servidor.chamar("get", "/projetos", { usuario: ctx.gerente })).corpo.find(
            (p: any) => p.codigo === "proj-sig",
        );
        expect(cartaoLista.colunas).toBeUndefined();
    });

    it("POST /projetos devolve o projeto com as quatro colunas padrão", async () => {
        const r = await servidor.chamar("post", "/projetos", {
            usuario: ctx.gerente,
            corpo: { nome: "Novo", descricao: "d", dataInicio, dataFim, ...(await obrigatoriosDoProjeto(ctx.factory)) },
        });
        expect(r.status).toBe(200);
        expect(r.corpo.colunas.map((c: any) => [c.nome, c.papel])).toEqual([
            ["A fazer", "entrada"],
            ["Fazendo", "meio"],
            ["Revisando", "meio"],
            ["Concluído", "concluida"],
        ]);
    });
});
