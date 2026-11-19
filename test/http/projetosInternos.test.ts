import Area from "../../source/domain/entity/Area";
import PeriodoArea from "../../source/domain/entity/PeriodoArea";
import Projeto from "../../source/domain/entity/Projeto";
import Usuario from "../../source/domain/entity/Usuario";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto } from "../fixtures";
import { subirServidor } from "./servidorTeste";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Sessão 23b: projeto interno, geral fixo e geral acompanhando a área. */
describe("Projetos internos e geral da área", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let diretor: Usuario;
    let ana: Usuario;
    let juridico: Area;
    const corpo = (extra: object = {}) => ({
        nome: "Processos internos",
        descricao: "Organizar",
        dataInicio: "2026-11-20T12:00:00.000Z",
        dataFim: "2026-12-20T12:00:00.000Z",
        ...extra,
    });

    async function geralDa(codigoArea: string): Promise<Projeto | null> {
        return ctx.factory.criarProjetoRepository().buscarGeralDaArea(codigoArea);
    }

    beforeEach(async () => {
        ctx = await criarContexto();
        diretor = new Usuario("Dora", "dora@konvex.com.br", PerfilUsuario.DIRETOR, true, "x", ctx.senioridade, "usr-dora");
        ana = new Usuario("Ana", "ana2@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-ana2");
        await ctx.factory.criarUsuarioRepository().criar(diretor);
        await ctx.factory.criarUsuarioRepository().criar(ana);
        servidor = await subirServidor(ctx.factory);
        const criada = await servidor.chamar("post", "/areas", { usuario: diretor, corpo: { nome: "Jurídico" } });
        juridico = criada.corpo;
        await ctx.factory.criarPeriodoAreaRepository().criar(new PeriodoArea(ana.codigo, juridico, null, dia("2026-01-10"), null, null));
    });

    afterEach(async () => servidor.fechar());

    describe("projeto interno", () => {
        it("interno sem área responde 400 AREA_OBRIGATORIA_INTERNO", async () => {
            const r = await servidor.chamar("post", "/projetos", { usuario: diretor, corpo: corpo({ tipo: "interno" }) });
            expect(r.status).toBe(400);
            expect(r.corpo.codigo).toBe("AREA_OBRIGATORIA_INTERNO");
        });

        it("interno com área cria com tipo interno", async () => {
            const r = await servidor.chamar("post", "/projetos", {
                usuario: diretor,
                corpo: corpo({ tipo: "interno", codigoArea: juridico.codigo }),
            });
            expect(r.status).toBe(200);
            expect(r.corpo.tipo).toBe("interno");
            expect(r.corpo.geralDaArea).toBe(false);
        });

        it("tipo fora de cliente e interno responde 400 TIPO_PROJETO_INVALIDO", async () => {
            const r = await servidor.chamar("post", "/projetos", { usuario: diretor, corpo: corpo({ tipo: "x" }) });
            expect(r.status).toBe(400);
            expect(r.corpo.codigo).toBe("TIPO_PROJETO_INVALIDO");
            expect(r.corpo.message ?? r.corpo.mensagem ?? JSON.stringify(r.corpo)).toContain("tipo");
        });

        it("GET /projetos?tipo=interno filtra", async () => {
            await servidor.chamar("post", "/projetos", { usuario: diretor, corpo: corpo({ nome: "De cliente" }) });
            await servidor.chamar("post", "/projetos", {
                usuario: diretor,
                corpo: corpo({ nome: "Interno", tipo: "interno", codigoArea: juridico.codigo }),
            });
            const r = await servidor.chamar("get", "/projetos?tipo=interno", { usuario: diretor });
            expect(r.status).toBe(200);
            expect(r.corpo.length).toBeGreaterThan(0);
            expect(r.corpo.every((p: any) => p.tipo === "interno")).toBe(true);
            const clientes = await servidor.chamar("get", "/projetos?tipo=cliente", { usuario: diretor });
            expect(clientes.corpo.map((p: any) => p.nome)).toEqual(["De cliente"]);
            const invalido = await servidor.chamar("get", "/projetos?tipo=x", { usuario: diretor });
            expect(invalido.status).toBe(400);
        });
    });

    describe("geral fixo", () => {
        it("GET do geral traz geralDaArea e lideresDaArea", async () => {
            const geral = (await geralDa(juridico.codigo))!;
            const r = await servidor.chamar("get", `/projetos/${geral.codigo}`, { usuario: diretor });
            expect(r.status).toBe(200);
            expect(r.corpo.geralDaArea).toBe(true);
            expect(Array.isArray(r.corpo.lideresDaArea)).toBe(true);
        });

        it.each([
            ["put", "", () => corpo({ tipo: "interno", codigoArea: juridico.codigo })],
            ["delete", "", () => undefined],
            ["patch", "/status", () => ({ status: "arquivado" })],
            ["put", "/acesso", () => ({ codigos: [ana.codigo] })],
            ["post", "/membros", () => ({ codigoUsuario: ana.codigo })],
            ["put", "/membros/qualquer", () => ({ funcao: "x" })],
            ["post", "/membros/qualquer/encerrar", () => ({})],
            ["put", "/lider", () => ({ codigoUsuario: ana.codigo })],
        ])("%s %s responde 400 PROJETO_GERAL_FIXO", async (metodo, sufixo, montarCorpo) => {
            const geral = (await geralDa(juridico.codigo))!;
            const r = await servidor.chamar(metodo, `/projetos/${geral.codigo}${sufixo}`, { usuario: diretor, corpo: montarCorpo() });
            expect(r.status).toBe(400);
            expect(r.corpo.codigo).toBe("PROJETO_GERAL_FIXO");
        });

        it("colunas continuam permitidas", async () => {
            const geral = (await geralDa(juridico.codigo))!;
            const colunas = (await servidor.chamar("get", `/projetos/${geral.codigo}`, { usuario: diretor })).corpo.colunas;
            const r = await servidor.chamar("put", `/projetos/${geral.codigo}/colunas`, { usuario: diretor, corpo: { colunas } });
            expect(r.status).toBe(200);
        });
    });

    describe("geral acompanha a área", () => {
        it("criar área cria o geral", async () => {
            const geral = await geralDa(juridico.codigo);
            expect(geral?.nome).toBe("Jurídico · geral");
            expect(geral?.status).toBe("em_execucao");
            expect(geral?.tipo).toBe("interno");
        });

        it("renomear, inativar e reativar a área acompanha o geral", async () => {
            const codigo = juridico.codigo;
            await servidor.chamar("put", `/areas/${codigo}`, { usuario: diretor, corpo: { nome: "Legal" } });
            expect((await geralDa(codigo))?.nome).toBe("Legal · geral");
            expect((await geralDa(codigo))?.area?.nome).toBe("Legal");
            await servidor.chamar("put", `/areas/${codigo}`, { usuario: diretor, corpo: { nome: "Legal", ativa: false } });
            expect((await geralDa(codigo))?.status).toBe("arquivado");
            await servidor.chamar("put", `/areas/${codigo}`, { usuario: diretor, corpo: { nome: "Legal", ativa: true } });
            expect((await geralDa(codigo))?.status).toBe("em_execucao");
        });

        it("não duplica o geral ao editar a área", async () => {
            await servidor.chamar("put", `/areas/${juridico.codigo}`, { usuario: diretor, corpo: { nome: "Jurídico" } });
            const todos = await ctx.factory.criarProjetoRepository().listar({});
            expect(todos.filter((p) => p.geralDaArea && p.area?.codigo === juridico.codigo)).toHaveLength(1);
        });

        it("com o geral arquivado, quem tem período na área ainda lê as tarefas", async () => {
            const geral = (await geralDa(juridico.codigo))!;
            const criada = await servidor.chamar("post", "/tarefas", {
                usuario: ana,
                corpo: {
                    codigoProjeto: geral.codigo,
                    titulo: "Revisar contrato",
                    dataInicio: "2026-11-20T12:00:00.000Z",
                    dataFim: "2026-11-27T12:00:00.000Z",
                    prioridade: "P2",
                },
            });
            expect(criada.status).toBe(200);
            await servidor.chamar("put", `/areas/${juridico.codigo}`, { usuario: diretor, corpo: { nome: "Jurídico", ativa: false } });
            const lista = await servidor.chamar("get", `/tarefas?codigoProjeto=${geral.codigo}`, { usuario: ana });
            expect(lista.status).toBe(200);
            expect(lista.corpo.map((t: any) => t.titulo)).toContain("Revisar contrato");
        });
    });
});
