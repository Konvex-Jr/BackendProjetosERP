import Area from "../../source/domain/entity/Area";
import Cargo from "../../source/domain/entity/Cargo";
import PeriodoArea from "../../source/domain/entity/PeriodoArea";
import Projeto from "../../source/domain/entity/Projeto";
import Tarefa from "../../source/domain/entity/Tarefa";
import Usuario from "../../source/domain/entity/Usuario";
import { novoGeral } from "../../source/domain/entity/ProjetoGeral";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import PrioridadeTarefa from "../../source/domain/enum/PrioridadeTarefa";
import StatusTarefa from "../../source/domain/enum/StatusTarefa";
import { criarContexto } from "../fixtures";
import { subirServidor } from "./servidorTeste";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Sessão 23b: toda tarefa num projeto; no geral da área, a equipe vem dos períodos e a liderança dos cargos. */
describe("Tarefas no projeto geral da área", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let ana: Usuario;
    let bia: Usuario;
    let caio: Usuario;
    let duda: Usuario;
    let eva: Usuario;
    let geral: Projeto;
    const corpo = (extra: object = {}) => ({
        codigoProjeto: geral.codigo,
        titulo: "Pesquisar ferramentas",
        dataInicio: "2026-11-20T12:00:00.000Z",
        dataFim: "2026-11-27T12:00:00.000Z",
        prioridade: "P2",
        ...extra,
    });

    async function novaPessoa(nome: string): Promise<Usuario> {
        const p = new Usuario(nome, `${nome}@konvex.com.br`, PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, `usr-${nome}`);
        await ctx.factory.criarUsuarioRepository().criar(p);
        return p;
    }

    /** Tarefa gravada direto no repositório (como as avulsas que a migração 018 levou ao geral). */
    async function tarefaDe(responsavel: Usuario, codigo: string): Promise<Tarefa> {
        return ctx.factory
            .criarTarefaRepository()
            .criar(
                new Tarefa(
                    geral,
                    "Tarefa antiga",
                    dia("2026-11-01"),
                    dia("2026-11-30"),
                    StatusTarefa.PENDENTE,
                    PrioridadeTarefa.P2,
                    null,
                    null,
                    null,
                    [responsavel],
                    [],
                    codigo,
                    null,
                    null,
                    geral.colunaDeEntrada,
                ),
            );
    }

    beforeEach(async () => {
        ctx = await criarContexto();
        const areas = ctx.factory.criarAreaRepository();
        const projetosArea = await areas.criar(new Area("Projetos"));
        const inovacao = await areas.criar(new Area("Inovação", projetosArea.codigo));
        const cargoLider = await ctx.factory.criarCargoRepository().criar(new Cargo("Gerente de Projetos", true, undefined, true));
        ana = await novaPessoa("ana");
        bia = await novaPessoa("bia");
        caio = await novaPessoa("caio");
        duda = await novaPessoa("duda");
        eva = await novaPessoa("eva");
        const periodos = ctx.factory.criarPeriodoAreaRepository();
        await periodos.criar(new PeriodoArea(ana.codigo, inovacao, null, dia("2026-01-10"), null, null));
        await periodos.criar(new PeriodoArea(eva.codigo, inovacao, null, dia("2026-01-10"), null, null));
        await periodos.criar(new PeriodoArea(bia.codigo, inovacao, null, dia("2025-01-10"), dia("2026-01-10"), null));
        await periodos.criar(new PeriodoArea(caio.codigo, projetosArea, cargoLider, dia("2026-01-10"), null, null));
        const criado = await ctx.factory.criarProjetoRepository().criar(novoGeral(inovacao, dia("2026-11-19")));
        geral = (await ctx.factory.criarProjetoRepository().buscarPorCodigo(criado.codigo))!;
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("membro da área cria e fica como responsável, comenta a de outra pessoa, mas não a move", async () => {
        const criada = await servidor.chamar("post", "/tarefas", {
            usuario: ana,
            corpo: corpo({ codigosResponsaveis: [eva.codigo] }),
        });
        expect(criada.status).toBe(200);
        expect(criada.corpo.responsaveis.map((r: any) => r.codigo)).toEqual([ana.codigo]);

        const daEva = await tarefaDe(eva, "tarefa-eva");
        const comentario = await servidor.chamar("post", `/tarefas/${daEva.codigo}/comentarios`, {
            usuario: ana,
            corpo: { texto: "Posso ajudar" },
        });
        expect(comentario.status).toBe(200);
        const colunaFinal = geral.colunas[geral.colunas.length - 1];
        const mover = await servidor.chamar("patch", `/tarefas/${daEva.codigo}/coluna`, {
            usuario: ana,
            corpo: { codigoColuna: colunaFinal.codigo },
        });
        expect(mover.status).toBe(403);
    });

    it("quem lidera a área (perfil membro) cria para outra pessoa, move, exclui e organiza o quadro", async () => {
        const criada = await servidor.chamar("post", "/tarefas", {
            usuario: caio,
            corpo: corpo({ codigosResponsaveis: [ana.codigo] }),
        });
        expect(criada.status).toBe(200);
        expect(criada.corpo.responsaveis.map((r: any) => r.codigo)).toEqual([ana.codigo]);

        const colunaFinal = geral.colunas[geral.colunas.length - 1];
        const mover = await servidor.chamar("patch", `/tarefas/${criada.corpo.codigo}/coluna`, {
            usuario: caio,
            corpo: { codigoColuna: colunaFinal.codigo },
        });
        expect(mover.status).toBe(200);

        const colunas = (await servidor.chamar("get", `/projetos/${geral.codigo}`, { usuario: caio })).corpo.colunas;
        const quadro = await servidor.chamar("put", `/projetos/${geral.codigo}/colunas`, { usuario: caio, corpo: { colunas } });
        expect(quadro.status).toBe(200);

        const excluir = await servidor.chamar("delete", `/tarefas/${criada.corpo.codigo}`, { usuario: caio });
        expect(excluir.status).toBe(200);
    });

    it("quem lidera a área não entra como responsável: não está na equipe do geral", async () => {
        const r = await servidor.chamar("post", "/tarefas", {
            usuario: caio,
            corpo: corpo({ codigosResponsaveis: [caio.codigo] }),
        });
        expect(r.status).toBe(400);
        expect(r.corpo.codigo).toBe("RESPONSAVEL_FORA_DO_PROJETO");
    });

    it("ex-membro da área vê as tarefas, mas não comenta; quem nunca esteve na área não vê", async () => {
        const daAna = await tarefaDe(ana, "tarefa-ana");
        const ids = async (u: Usuario) => (await servidor.chamar("get", "/tarefas", { usuario: u })).corpo.map((t: any) => t.codigo);
        expect(await ids(bia)).toEqual([daAna.codigo]);
        expect(await ids(caio)).toEqual([daAna.codigo]);
        expect(await ids(duda)).toEqual([]);
        const comentario = await servidor.chamar("post", `/tarefas/${daAna.codigo}/comentarios`, {
            usuario: bia,
            corpo: { texto: "Oi" },
        });
        expect(comentario.status).toBe(403);
    });

    it("avulsa migrada com responsável de fora da área: editar só o título mantém o responsável", async () => {
        const antiga = await tarefaDe(duda, "tarefa-migrada");
        const r = await servidor.chamar("put", `/tarefas/${antiga.codigo}`, {
            usuario: ctx.gerente,
            corpo: {
                titulo: "Título novo",
                dataInicio: "2026-11-01T00:00:00.000Z",
                dataFim: "2026-11-30T00:00:00.000Z",
                status: "pendente",
                prioridade: "P2",
                codigosResponsaveis: [duda.codigo],
            },
        });
        expect(r.status).toBe(200);
        expect(r.corpo.titulo).toBe("Título novo");
        expect(r.corpo.responsaveis.map((x: any) => x.codigo)).toEqual([duda.codigo]);
    });

    it.each([
        ["gerente", () => ctx.gerente],
        ["membro", () => ana],
    ])("POST sem projeto (%s): 400 PROJETO_OBRIGATORIO, mesmo com categoria", async (_nome, quem) => {
        const { codigoProjeto: _semProjeto, ...semProjeto } = corpo({ categoria: "inovacao" });
        const r = await servidor.chamar("post", "/tarefas", { usuario: quem(), corpo: semProjeto });
        expect(r.status).toBe(400);
        expect(r.corpo.codigo).toBe("PROJETO_OBRIGATORIO");
    });

    it("GET com categoria=avulsas ignora o parâmetro", async () => {
        const daAna = await tarefaDe(ana, "tarefa-ana");
        const r = await servidor.chamar("get", "/tarefas?categoria=avulsas", { usuario: ctx.gerente });
        expect(r.status).toBe(200);
        expect(r.corpo.map((t: any) => t.codigo)).toEqual([daAna.codigo]);
    });
});
