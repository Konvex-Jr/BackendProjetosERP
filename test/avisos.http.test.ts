import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import Usuario from "../source/domain/entity/Usuario";
import DificuldadeTarefa from "../source/domain/enum/DificuldadeTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import { hoje } from "../source/shared/datas";
import { criarContexto } from "./fixtures";
import { subirServidor } from "./http/servidorTeste";
import { Papel, comPapel } from "./papel";

const UM_DIA = 86_400_000;

/** Sessão 26a: GET /avisos e PATCH /avisos/lidos, com sigilo, corte de 30, limpeza e sobrecarga só para a gestão. */
describe("Avisos (HTTP)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let diretor: Usuario;
    let trainee: Usuario;
    let sobrecarregado: Usuario;
    let normal: Projeto;
    let sigiloso: Projeto;
    const dia = hoje();

    const tarefa = (
        projeto: Projeto,
        titulo: string,
        codigo: string,
        responsaveis: Usuario[],
        dificuldade: DificuldadeTarefa | null = null,
    ) =>
        new Tarefa(
            projeto,
            titulo,
            dia,
            new Date(dia.getTime() + 10 * UM_DIA),
            StatusTarefa.PENDENTE,
            PrioridadeTarefa.P2,
            null,
            null,
            null,
            responsaveis,
            [],
            codigo,
            null,
            null,
            null,
            dificuldade,
        );
    const avisar = (codigoUsuario: string, codigoTarefa: string) =>
        ctx.factory
            .criarAvisoRepository()
            .criarVarios([
                { codigoUsuario, tipo: "tarefa_recebida", codigoTarefa, codigoCapacitacao: null, codigoAutor: ctx.gerente.codigo },
            ]);
    /** O repositório em memória não deixa escolher as datas: ajusta direto nos registros. */
    const registros = (): any[] => (ctx.factory.criarAvisoRepository() as any).registros;

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const novo = async (nome: string, perfil: Papel, codigo: string, status = StatusPessoa.ATIVO) => {
            const u = comPapel(new Usuario(nome, `${codigo}@konvex.com.br`, true, "x", ctx.senioridade, codigo, { status }), perfil);
            await usuarios.criar(u);
            return u;
        };
        diretor = await novo("Dora Diretora", "diretor", "usr-dora");
        trainee = await novo("Téo Trainee", "membro", "usr-teo", StatusPessoa.TRAINEE);
        sobrecarregado = await novo("Sol Sobrecarga", "membro", "usr-sol");

        const area = await ctx.factory.criarAreaRepository().criar(new Area("Projetos"));
        const cargo = await ctx.factory.criarCargoRepository().criar(new Cargo("Assessor", true, undefined, false, 10));
        await ctx.factory
            .criarPeriodoAreaRepository()
            .criar(new PeriodoArea(sobrecarregado.codigo, area, cargo, new Date("2026-01-01T00:00:00.000Z"), null, null));

        const projetos = ctx.factory.criarProjetoRepository();
        const inicio = new Date(dia.getTime() - 30 * UM_DIA);
        const fim = new Date(dia.getTime() + 60 * UM_DIA);
        normal = await projetos.criar(new Projeto("Normal", "d", inicio, fim, undefined, [ctx.membro, trainee, sobrecarregado], "p-nor"));
        sigiloso = await projetos.criar(
            new Projeto("Projeto Secreto", "d", inicio, fim, undefined, [ctx.membro], "p-sig", {
                sigiloso: true,
                criadoPor: diretor.codigo,
            }),
        );
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("sem login: 401 nos dois", async () => {
        expect((await servidor.chamar("get", "/avisos")).status).toBe(401);
        expect((await servidor.chamar("patch", "/avisos/lidos", { corpo: {} })).status).toBe(401);
    });

    it("membro recebe tarefa de outro: 1 não lido, com título, projeto e autor", async () => {
        await ctx.factory.criarTarefaRepository().criar(tarefa(normal, "Relatório", "t-1", [ctx.membro]));
        await avisar(ctx.membro.codigo, "t-1");
        const r = await servidor.chamar("get", "/avisos", { usuario: ctx.membro });
        expect(r.status).toBe(200);
        expect(r.corpo.naoLidos).toBe(1);
        expect(r.corpo.gravados).toHaveLength(1);
        expect(r.corpo.gravados[0]).toMatchObject({
            tipo: "tarefa_recebida",
            lido: false,
            autor: { codigo: ctx.gerente.codigo },
            tarefa: { codigo: "t-1", titulo: "Relatório", projeto: { codigo: "p-nor", nome: "Normal" } },
        });
    });

    it("saiu da equipe do sigiloso (segue responsável): aviso some e a tarefa sai da situação", async () => {
        const outra = comPapel(new Usuario("Out", "out@konvex.com.br", true, "x", ctx.senioridade, "usr-out"), "membro");
        await ctx.factory.criarUsuarioRepository().criar(outra);
        const atrasada = new Tarefa(
            sigiloso,
            "Segredo",
            new Date(dia.getTime() - 10 * UM_DIA),
            new Date(dia.getTime() - 2 * UM_DIA),
            StatusTarefa.PENDENTE,
            PrioridadeTarefa.P2,
            null,
            null,
            null,
            [outra],
            [],
            "t-sig",
        );
        await ctx.factory.criarTarefaRepository().criar(atrasada);
        await avisar(outra.codigo, "t-sig");
        const r = await servidor.chamar("get", "/avisos", { usuario: outra });
        expect(r.corpo).toEqual({ naoLidos: 0, gravados: [], situacao: [] });
        // quem vê (diretor, que também é responsável) recebe
        await ctx.factory
            .criarTarefaRepository()
            .criar(
                new Tarefa(
                    sigiloso,
                    "Segredo 2",
                    atrasada.dataInicio,
                    atrasada.dataFim,
                    StatusTarefa.PENDENTE,
                    PrioridadeTarefa.P2,
                    null,
                    null,
                    null,
                    [diretor],
                    [],
                    "t-sig2",
                ),
            );
        await avisar(diretor.codigo, "t-sig2");
        const d = await servidor.chamar("get", "/avisos", { usuario: diretor });
        expect(d.corpo.naoLidos).toBe(1);
        expect(d.corpo.situacao[0]).toMatchObject({ tipo: "tarefas_atrasadas" });
    });

    it("gerente fora do sigiloso (acesso resumo): título não aparece nos gravados nem na situação", async () => {
        await ctx.factory
            .criarTarefaRepository()
            .criar(
                new Tarefa(
                    sigiloso,
                    "Título secreto",
                    new Date(dia.getTime() - 10 * UM_DIA),
                    new Date(dia.getTime() - 2 * UM_DIA),
                    StatusTarefa.PENDENTE,
                    PrioridadeTarefa.P2,
                    null,
                    null,
                    null,
                    [ctx.gerente],
                    [],
                    "t-res",
                ),
            );
        await avisar(ctx.gerente.codigo, "t-res");
        const r = await servidor.chamar("get", "/avisos", { usuario: ctx.gerente });
        expect(r.status).toBe(200);
        expect(r.corpo.naoLidos).toBe(0);
        expect(r.corpo.gravados).toEqual([]);
        expect(r.corpo.situacao.find((i: any) => i.tipo !== "sobrecarga")).toBeUndefined();
        expect(JSON.stringify(r.corpo)).not.toContain("Título secreto");
    });

    it("tarefa excluída: aviso some", async () => {
        await ctx.factory.criarTarefaRepository().criar(tarefa(normal, "Relatório", "t-1", [ctx.membro]));
        await avisar(ctx.membro.codigo, "t-1");
        await ctx.factory.criarTarefaRepository().excluir("t-1");
        const r = await servidor.chamar("get", "/avisos", { usuario: ctx.membro });
        expect(r.corpo).toMatchObject({ naoLidos: 0, gravados: [] });
    });

    it("35 avisos: devolve 30 e conta os 35", async () => {
        const repo = ctx.factory.criarTarefaRepository();
        for (let i = 0; i < 35; i++) {
            await repo.criar(tarefa(normal, `T${i}`, `t-${i}`, [ctx.membro]));
            await avisar(ctx.membro.codigo, `t-${i}`);
        }
        const r = await servidor.chamar("get", "/avisos", { usuario: ctx.membro });
        expect(r.corpo.gravados).toHaveLength(30);
        expect(r.corpo.naoLidos).toBe(35);
        expect(r.corpo.gravados[0].tarefa.codigo).toBe("t-34");
    });

    it("lido há 31 dias some; lido há 29 fica", async () => {
        const repo = ctx.factory.criarTarefaRepository();
        await repo.criar(tarefa(normal, "Velha", "t-velha", [ctx.membro]));
        await repo.criar(tarefa(normal, "Recente", "t-recente", [ctx.membro]));
        await avisar(ctx.membro.codigo, "t-velha");
        await avisar(ctx.membro.codigo, "t-recente");
        for (const reg of registros()) reg.lidoEm = new Date(Date.now() - (reg.codigoTarefa === "t-velha" ? 31 : 29) * UM_DIA);
        const r = await servidor.chamar("get", "/avisos", { usuario: ctx.membro });
        expect(r.corpo.gravados.map((g: any) => g.tarefa.codigo)).toEqual(["t-recente"]);
        expect(r.corpo.naoLidos).toBe(0);
        expect(registros()).toHaveLength(1);
    });

    describe("sobrecarga na situação", () => {
        beforeEach(async () => {
            const repo = ctx.factory.criarTarefaRepository();
            // Seis Difíceis de hoje: cada uma vale 1 dia inteiro (2 h com teto de 10 h), em qualquer dia da semana.
            // 6 × 2 h = 12 h sobre o teto de 10 h = 120%.
            for (const [titulo, codigo, nivel] of ["a", "b", "c", "d", "e", "f"].map(
                (x) => [`Pesada ${x}`, `t-${x}`, DificuldadeTarefa.DIFICIL] as const,
            )) {
                const t = tarefa(normal, titulo, codigo, [sobrecarregado], nivel);
                await repo.criar(
                    new Tarefa(
                        normal,
                        titulo,
                        dia,
                        dia,
                        t.status,
                        t.prioridade,
                        null,
                        null,
                        null,
                        [sobrecarregado],
                        [],
                        codigo,
                        null,
                        null,
                        null,
                        nivel,
                    ),
                );
            }
        });

        it("diretor e gerente recebem", async () => {
            for (const u of [diretor, ctx.gerente]) {
                const r = await servidor.chamar("get", "/avisos", { usuario: u });
                const item = r.corpo.situacao.find((i: any) => i.tipo === "sobrecarga");
                expect(item.pessoas).toEqual([{ codigoUsuario: sobrecarregado.codigo, nome: "Sol Sobrecarga", percentual: 120 }]);
            }
        });

        it("membro e trainee não recebem, mesmo com alguém acima de 100%", async () => {
            for (const u of [ctx.membro, trainee]) {
                const r = await servidor.chamar("get", "/avisos", { usuario: u });
                expect(r.corpo.situacao.find((i: any) => i.tipo === "sobrecarga")).toBeUndefined();
            }
        });
    });

    describe("PATCH /avisos/lidos", () => {
        beforeEach(async () => {
            const repo = ctx.factory.criarTarefaRepository();
            await repo.criar(tarefa(normal, "Minha", "t-1", [ctx.membro, trainee]));
            await avisar(ctx.membro.codigo, "t-1");
            await avisar(trainee.codigo, "t-1");
        });

        it("código de outra pessoa: 200 e o dela segue não lido", async () => {
            const dela = registros().find((r) => r.codigoUsuario === trainee.codigo).codigo;
            const r = await servidor.chamar("patch", "/avisos/lidos", { usuario: ctx.membro, corpo: { codigos: [dela] } });
            expect(r.status).toBe(200);
            expect(r.corpo).toEqual({ naoLidos: 1 });
            expect((await servidor.chamar("get", "/avisos", { usuario: trainee })).corpo.naoLidos).toBe(1);
        });

        it("código malformado: 200 sem efeito", async () => {
            const r = await servidor.chamar("patch", "/avisos/lidos", { usuario: ctx.membro, corpo: { codigos: ["x"] } });
            expect(r.status).toBe(200);
            expect(r.corpo).toEqual({ naoLidos: 1 });
        });

        it("codigos que não é lista: 400", async () => {
            for (const codigos of ["x", [1]]) {
                const r = await servidor.chamar("patch", "/avisos/lidos", { usuario: ctx.membro, corpo: { codigos } });
                expect(r.status).toBe(400);
                expect(r.corpo.codigo).toBe("AVISOS_CODIGOS_INVALIDOS");
            }
        });

        it("sem corpo ou sem codigos: marca todos", async () => {
            const r = await servidor.chamar("patch", "/avisos/lidos", { usuario: ctx.membro });
            expect(r.status).toBe(200);
            expect(r.corpo).toEqual({ naoLidos: 0 });
            expect((await servidor.chamar("get", "/avisos", { usuario: ctx.membro })).corpo.gravados[0].lido).toBe(true);
            expect((await servidor.chamar("get", "/avisos", { usuario: trainee })).corpo.naoLidos).toBe(1);
        });
    });
});
