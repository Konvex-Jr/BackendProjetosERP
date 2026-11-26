import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import { criarContexto, dataFim, dataInicio, obrigatoriosDoProjeto } from "../fixtures";
import { subirServidor } from "./servidorTeste";
import { comPapel } from "../papel";

/**
 * Sessão 31b: clientes do projeto (telefone e e-mail só com clientes.ver), classe do projeto,
 * sigilo "Só diretoria" na Biblioteca e % no cartão.
 */
describe("Clientes, classe e contratos (31b)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let diretor: Usuario;
    const ANA = { nome: "Ana Souza", empresa: "Padaria Sol", telefone: "(34) 99999-1111", email: "ana@padariasol.com" };
    const BRUNO = { nome: "Bruno Lima", empresa: "Sol Delivery", telefone: "(34) 98888-2222", email: "bruno@soldelivery.com" };

    const chamar = (metodo: string, caminho: string, usuario?: Usuario, corpo?: unknown) =>
        servidor.chamar(metodo, caminho, { usuario, corpo });

    beforeEach(async () => {
        ctx = await criarContexto();
        diretor = comPapel(new Usuario("Dora Diretora", "dora@konvex.com.br", true, "h", ctx.senioridade, "usr-dora"), "diretor");
        await ctx.factory.criarUsuarioRepository().criar(diretor);
        await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("Padaria", "d", dataInicio, dataFim, undefined, [ctx.membro], "p-pad", { clientes: [ANA, BRUNO] }));
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("equipe vê nome e empresa; quem tem clientes.ver vê telefone e e-mail", async () => {
        const equipe = await chamar("get", "/projetos/p-pad", ctx.membro);
        expect(equipe.corpo.clientes).toEqual([
            { nome: ANA.nome, empresa: ANA.empresa },
            { nome: BRUNO.nome, empresa: BRUNO.empresa },
        ]);
        expect(JSON.stringify(equipe.corpo)).not.toContain("99999");
        const gerente = await chamar("get", "/projetos", ctx.gerente);
        expect(JSON.stringify(gerente.corpo)).not.toContain("padariasol");
        const dir = await chamar("get", "/projetos/p-pad", diretor);
        expect(dir.corpo.clientes).toEqual([ANA, BRUNO]);
    });

    it("membro de fora recebe o cartão com o %, sem clientes", async () => {
        const fora = comPapel(new Usuario("Fábio", "fabio@konvex.com.br", true, "h", ctx.senioridade, "usr-fabio"), "membro");
        await ctx.factory.criarUsuarioRepository().criar(fora);
        const r = await chamar("get", "/projetos/p-pad", fora);
        expect(r.corpo.cartao).toBe(true);
        expect(r.corpo.progresso).toBe(0);
        expect(JSON.stringify(r.corpo)).not.toContain("Ana Souza");
    });

    it("POST e PUT com clientes: 403 sem clientes.ver; diretor grava", async () => {
        const corpo = {
            nome: "Novo",
            descricao: "d",
            dataInicio: "2026-10-12",
            dataFim: "2026-10-30",
            ...(await obrigatoriosDoProjeto(ctx.factory)),
            codigosMembros: [ctx.gerente.codigo],
        };
        const negado = await chamar("post", "/projetos", ctx.gerente, { ...corpo, clientes: [ANA] });
        expect(negado.status).toBe(403);
        const criado = await chamar("post", "/projetos", ctx.gerente, corpo);
        expect(criado.status).toBe(200);
        expect(criado.corpo.classe).toMatchObject({ codigo: "outro", nome: "Outro" });
        expect(criado.corpo.clientes).toEqual([]);

        const editar = { nome: "Novo", descricao: "d", dataInicio: "2026-10-12", dataFim: "2026-10-30" };
        const put = await chamar("put", `/projetos/${criado.corpo.codigo}`, ctx.gerente, { ...editar, clientes: [ANA] });
        expect(put.status).toBe(403);
        const dir = await chamar("put", `/projetos/${criado.corpo.codigo}`, diretor, { ...editar, clientes: [ANA, { nome: "Caio" }] });
        expect(dir.status).toBe(200);
        expect(dir.corpo.clientes).toEqual([ANA, { nome: "Caio", empresa: null, telefone: null, email: null }]);
        // Editar sem mandar clientes não apaga a lista.
        const semClientes = await chamar("put", `/projetos/${criado.corpo.codigo}`, ctx.gerente, editar);
        expect(semClientes.corpo.clientes).toHaveLength(2);
    });

    it("telefone inválido: 400 dizendo qual cliente", async () => {
        const r = await chamar("put", "/projetos/p-pad", diretor, {
            nome: "Padaria",
            descricao: "d",
            dataInicio: "2026-10-12",
            dataFim: "2026-10-30",
            clientes: [ANA, { nome: "X", telefone: "12" }],
        });
        expect(r.status).toBe(400);
        expect(r.corpo.codigo ?? r.corpo.code).toBe("CLIENTE_TELEFONE_INVALIDO");
        expect(JSON.stringify(r.corpo)).toContain("cliente 2");
    });

    it("busca acha pelo nome e pela empresa do cliente, não pelo telefone", async () => {
        expect((await chamar("get", "/projetos?busca=delivery", ctx.membro)).corpo).toHaveLength(1);
        expect((await chamar("get", "/projetos?busca=98888", ctx.membro)).corpo).toHaveLength(0);
    });

    it("classes: todos leem; só quem configura a estrutura cria e renomeia; nome repetido 409", async () => {
        const lista = await chamar("get", "/classes-projeto", ctx.membro);
        expect(lista.corpo.map((c: any) => c.nome)).toContain("Landing page");
        expect((await chamar("post", "/classes-projeto", ctx.membro, { nome: "ERP" })).status).toBe(403);
        const nova = await chamar("post", "/classes-projeto", diretor, { nome: "ERP" });
        expect(nova.status).toBe(200);
        expect(nova.corpo.codigo).toBe("erp");
        expect((await chamar("post", "/classes-projeto", diretor, { nome: "crm" })).status).toBe(409);
        const renomeada = await chamar("put", "/classes-projeto/erp", diretor, { nome: "Sistema ERP" });
        expect(renomeada.corpo.nome).toBe("Sistema ERP");
        expect((await chamar("post", "/classes-projeto", diretor, { nome: "  " })).status).toBe(400);
    });

    describe("Biblioteca: sigilo Só diretoria", () => {
        const contrato = { titulo: "Contrato Padaria", conteudo: "assinado", sigilo: "diretoria" };

        it("sem clientes.ver não cria; diretor cria; gerente e membro não veem (404)", async () => {
            expect((await chamar("post", "/biblioteca", ctx.gerente, contrato)).status).toBe(403);
            const criado = await chamar("post", "/biblioteca", diretor, contrato);
            expect(criado.status).toBe(200);
            const codigo = criado.corpo.codigo;
            expect((await chamar("get", `/biblioteca/${codigo}`, ctx.gerente)).status).toBe(404);
            expect((await chamar("get", `/biblioteca/${codigo}`, ctx.membro)).status).toBe(404);
            expect((await chamar("get", "/biblioteca", ctx.gerente)).corpo.map((i: any) => i.titulo)).not.toContain("Contrato Padaria");
            expect((await chamar("get", `/biblioteca/${codigo}`, diretor)).status).toBe(200);
        });

        it("gerente não troca o sigilo do próprio item para Só diretoria", async () => {
            const item = await chamar("post", "/biblioteca", ctx.gerente, { titulo: "Ata", conteudo: "x", sigilo: "todos" });
            const r = await chamar("put", `/biblioteca/${item.corpo.codigo}`, ctx.gerente, { sigilo: "diretoria" });
            expect(r.status).toBe(403);
        });
    });
});
