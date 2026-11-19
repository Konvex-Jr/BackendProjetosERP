import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import Usuario from "../source/domain/entity/Usuario";
import DificuldadeTarefa from "../source/domain/enum/DificuldadeTarefa";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import ConsultarOcupacao from "../source/useCases/tarefas/ConsultarOcupacao";
import { diaNoFuso, hoje } from "../source/shared/datas";
import { criarContexto } from "./fixtures";
import { subirServidor } from "./http/servidorTeste";

const UM_DIA = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Sessão 24a: GET /ocupacao, detalhe por pessoa com sigilo e avisos ao salvar tarefa. */
describe("Ocupação semanal (HTTP)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let assessor: Usuario; // tem 4 h (Média) no sigiloso nesta semana
    let fora: Usuario; // membro sem relação com o sigiloso
    let diretor: Usuario;
    let trainee: Usuario;
    let alumni: Usuario;
    let normal: Projeto;
    let area: Area;
    const dia = hoje();

    const novaTarefa = (
        projeto: Projeto,
        titulo: string,
        dificuldade: DificuldadeTarefa,
        status = StatusTarefa.PENDENTE,
        codigo?: string,
    ) =>
        new Tarefa(
            projeto,
            titulo,
            dia,
            dia,
            status,
            PrioridadeTarefa.P2,
            null,
            status === StatusTarefa.CONCLUIDA ? dia : null,
            null,
            [assessor],
            [],
            codigo,
            null,
            null,
            null,
            dificuldade,
        );

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const novo = async (nome: string, perfil: PerfilUsuario, codigo: string, status = StatusPessoa.ATIVO) => {
            const u = new Usuario(nome, `${codigo}@konvex.com.br`, perfil, true, "x", ctx.senioridade, codigo, { status });
            await usuarios.criar(u);
            return u;
        };
        assessor = await novo("Ivo Assessor", PerfilUsuario.MEMBRO, "usr-ivo");
        fora = await novo("Fê Fora", PerfilUsuario.MEMBRO, "usr-fe");
        diretor = await novo("Dora Diretora", PerfilUsuario.DIRETOR, "usr-dora");
        trainee = await novo("Téo Trainee", PerfilUsuario.MEMBRO, "usr-teo", StatusPessoa.TRAINEE);
        alumni = await novo("Alu Alumni", PerfilUsuario.MEMBRO, "usr-alu", StatusPessoa.ALUMNI);

        area = await ctx.factory.criarAreaRepository().criar(new Area("Projetos"));
        const cargo = await ctx.factory.criarCargoRepository().criar(new Cargo("Assessor", true, undefined, false, 10));
        await ctx.factory
            .criarPeriodoAreaRepository()
            .criar(new PeriodoArea(assessor.codigo, area, cargo, new Date("2026-01-01T00:00:00.000Z"), null, null));

        const projetos = ctx.factory.criarProjetoRepository();
        const inicio = new Date(dia.getTime() - 30 * UM_DIA);
        const fim = new Date(dia.getTime() + 60 * UM_DIA);
        const sigiloso = await projetos.criar(
            new Projeto("Projeto Secreto", "d", inicio, fim, undefined, [assessor], "p-sig", { sigiloso: true, criadoPor: "usr-dora" }),
        );
        normal = await projetos.criar(new Projeto("Normal", "d", inicio, fim, undefined, [assessor, ctx.membro], "p-nor"));
        await ctx.factory
            .criarTarefaRepository()
            .criar(novaTarefa(sigiloso, "Título secreto", DificuldadeTarefa.MEDIA, undefined, "t-sig"));
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    describe("GET /ocupacao", () => {
        it("sem login: 401", async () => {
            expect((await servidor.chamar("get", "/ocupacao")).status).toBe(401);
            expect((await servidor.chamar("get", "/ocupacao/usr-ivo")).status).toBe(401);
        });

        it("logado recebe todos os ativos (com trainee, sem alumni) com percentual", async () => {
            const r = await servidor.chamar("get", "/ocupacao", { usuario: fora });
            expect(r.status).toBe(200);
            const codigos = r.corpo.map((p: any) => p.codigoUsuario).sort();
            expect(codigos).toEqual(
                [ctx.membro.codigo, ctx.gerente.codigo, diretor.codigo, fora.codigo, assessor.codigo, trainee.codigo].sort(),
            );
            expect(codigos).not.toContain(alumni.codigo);
            expect(r.corpo.every((p: any) => typeof p.percentual === "number")).toBe(true);
            expect(r.corpo.find((p: any) => p.codigoUsuario === assessor.codigo)).toEqual({
                codigoUsuario: assessor.codigo,
                nome: "Ivo Assessor",
                horas: 4,
                teto: 10,
                percentual: 40,
            });
            // Total não revela tarefas
            expect(JSON.stringify(r.corpo)).not.toContain("Título secreto");
        });

        it("semana inválida: 400 SEMANA_INVALIDA; pessoa inexistente: 404", async () => {
            for (const semana of ["ontem", "2026-02-30", "2026-1-5"]) {
                const r = await servidor.chamar("get", `/ocupacao?semana=${semana}`, { usuario: fora });
                expect(r.status).toBe(400);
                expect(r.corpo.codigo).toBe("SEMANA_INVALIDA");
            }
            expect((await servidor.chamar("get", "/ocupacao/usr-ivo?semana=x", { usuario: fora })).corpo.codigo).toBe("SEMANA_INVALIDA");
            expect((await servidor.chamar("get", "/ocupacao/usr-nao-existe", { usuario: fora })).status).toBe(404);
        });

        it("semana passada sem a tarefa: 0 h; qualquer dia da semana serve", async () => {
            const passada = new Date(dia.getTime() - 14 * UM_DIA);
            const r = await servidor.chamar("get", `/ocupacao/usr-ivo?semana=${iso(passada)}`, { usuario: diretor });
            expect(r.status).toBe(200);
            expect(r.corpo).toMatchObject({ horas: 0, percentual: 0, itens: [] });
        });
    });

    describe("GET /ocupacao/:codigoUsuario (detalhe)", () => {
        it("membro de fora do sigiloso: uma linha 'outras', sem título nem projeto em lugar nenhum", async () => {
            const r = await servidor.chamar("get", "/ocupacao/usr-ivo", { usuario: fora });
            expect(r.status).toBe(200);
            expect(r.corpo).toMatchObject({ codigoUsuario: "usr-ivo", horas: 4, teto: 10, percentual: 40 });
            expect(r.corpo.itens).toEqual([{ tipo: "outras", horas: 4 }]);
            const texto = JSON.stringify(r.corpo);
            expect(texto).not.toContain("Título secreto");
            expect(texto).not.toContain("Projeto Secreto");
            expect(texto).not.toContain("titulo");
            expect(texto).not.toContain("t-sig");
            expect(texto).not.toContain("p-sig");
        });

        it("gerente fora do sigiloso: linha do projeto com o nome, sem título", async () => {
            const r = await servidor.chamar("get", "/ocupacao/usr-ivo", { usuario: ctx.gerente });
            expect(r.corpo.itens).toEqual([{ tipo: "projeto", projeto: { codigo: "p-sig", nome: "Projeto Secreto" }, horas: 4 }]);
            const texto = JSON.stringify(r.corpo);
            expect(texto).not.toContain("Título secreto");
            expect(texto).not.toContain("titulo");
            expect(texto).not.toContain("t-sig");
        });

        it("diretor: linha da tarefa com título e projeto", async () => {
            const r = await servidor.chamar("get", "/ocupacao/usr-ivo", { usuario: diretor });
            expect(r.corpo.itens).toEqual([
                {
                    tipo: "tarefa",
                    codigo: "t-sig",
                    titulo: "Título secreto",
                    projeto: { codigo: "p-sig", nome: "Projeto Secreto" },
                    horas: 4,
                },
            ]);
            expect(r.corpo.semana).toBe(iso(new Date(dia.getTime() - ((dia.getUTCDay() + 6) % 7) * UM_DIA)));
        });
    });

    describe("avisos ao salvar tarefa", () => {
        const corpoTarefa = (extra: Record<string, unknown> = {}) => ({
            codigoProjeto: "p-nor",
            titulo: "Relatório final",
            dataInicio: iso(dia),
            dataFim: iso(dia),
            prioridade: "P2",
            status: "pendente",
            dificuldade: "dificil",
            codigosResponsaveis: [assessor.codigo],
            ...extra,
        });

        it("POST de tarefa Difícil de um dia para assessor com 4 h: aviso de 120%", async () => {
            const r = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoTarefa() });
            expect(r.status).toBe(200);
            expect(r.corpo.titulo).toBe("Relatório final");
            expect(r.corpo.quantidadeAnexos).toBe(0);
            expect(r.corpo.avisosOcupacao).toHaveLength(1);
            expect(r.corpo.avisosOcupacao[0]).toMatchObject({
                codigoUsuario: assessor.codigo,
                nome: "Ivo Assessor",
                horas: 12,
                teto: 10,
                percentual: 120,
            });
            expect(r.corpo.avisosOcupacao[0].percentual).toBe(120);
        });

        it("POST que não passa de 100%: avisosOcupacao vazio", async () => {
            const r = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoTarefa({ dificuldade: "facil" }) });
            expect(r.status).toBe(200);
            expect(r.corpo.avisosOcupacao).toEqual([]);
        });

        it("PUT só do título: avisosOcupacao vazio (mesmo acima de 100%)", async () => {
            const criada = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoTarefa() });
            expect(criada.corpo.avisosOcupacao).toHaveLength(1);
            const r = await servidor.chamar("put", `/tarefas/${criada.corpo.codigo}`, {
                usuario: ctx.gerente,
                corpo: corpoTarefa({ titulo: "Outro título" }),
            });
            expect(r.status).toBe(200);
            expect(r.corpo.titulo).toBe("Outro título");
            expect(r.corpo.avisosOcupacao).toEqual([]);
        });

        it("PUT que muda a dificuldade: aviso", async () => {
            const criada = await servidor.chamar("post", "/tarefas", {
                usuario: ctx.gerente,
                corpo: corpoTarefa({ dificuldade: "rapida" }),
            });
            expect(criada.corpo.avisosOcupacao).toEqual([]);
            const r = await servidor.chamar("put", `/tarefas/${criada.corpo.codigo}`, { usuario: ctx.gerente, corpo: corpoTarefa() });
            expect(r.corpo.avisosOcupacao.map((a: any) => a.percentual)).toEqual([120]);
        });

        it("PATCH coluna que reabre tarefa concluída e passa de 100%: aviso", async () => {
            await ctx.factory
                .criarTarefaRepository()
                .criar(novaTarefa(normal, "Concluída", DificuldadeTarefa.DIFICIL, StatusTarefa.CONCLUIDA, "t-conc"));
            const r = await servidor.chamar("patch", "/tarefas/t-conc/coluna", {
                usuario: ctx.gerente,
                corpo: { codigoColuna: normal.colunaDeEntrada.codigo },
            });
            expect(r.status).toBe(200);
            expect(r.corpo.status).toBe("pendente");
            expect(r.corpo.avisosOcupacao).toHaveLength(1);
            expect(r.corpo.avisosOcupacao[0]).toMatchObject({ codigoUsuario: assessor.codigo, percentual: 120 });
        });

        it("PATCH status que conclui: avisosOcupacao vazio", async () => {
            await ctx.factory.criarTarefaRepository().criar(novaTarefa(normal, "Aberta", DificuldadeTarefa.DIFICIL, undefined, "t-ab"));
            const r = await servidor.chamar("patch", "/tarefas/t-ab/status", { usuario: ctx.gerente, corpo: { status: "concluida" } });
            expect(r.status).toBe(200);
            expect(r.corpo.avisosOcupacao).toEqual([]);
        });

        describe("datas com hora (a tela manda meio-dia local, 15:00Z)", () => {
            const segundaQueVem = new Date(dia.getTime() + (7 - ((dia.getUTCDay() + 6) % 7)) * UM_DIA);
            const sextaQueVem = new Date(segundaQueVem.getTime() + 4 * UM_DIA);
            const as15 = (d: Date) => `${iso(d)}T15:00:00.000Z`;
            const corpoSemanaQueVem = (extra: Record<string, unknown> = {}) =>
                corpoTarefa({ dataInicio: as15(segundaQueVem), dataFim: as15(sextaQueVem), ...extra });

            beforeEach(async () => {
                // Já tem uma Média (4 h) na segunda da semana que vem.
                await ctx.factory
                    .criarTarefaRepository()
                    .criar(
                        new Tarefa(
                            normal,
                            "Média de segunda",
                            segundaQueVem,
                            segundaQueVem,
                            StatusTarefa.PENDENTE,
                            PrioridadeTarefa.P2,
                            null,
                            null,
                            null,
                            [assessor],
                            [],
                            "t-seg",
                            null,
                            null,
                            null,
                            DificuldadeTarefa.MEDIA,
                        ),
                    );
            });

            it("Difícil de segunda a sexta da semana que vem: aviso de 120% (nenhum dia perdido)", async () => {
                const r = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoSemanaQueVem() });
                expect(r.status).toBe(200);
                expect(r.corpo.avisosOcupacao).toHaveLength(1);
                expect(r.corpo.avisosOcupacao[0]).toMatchObject({
                    codigoUsuario: assessor.codigo,
                    horas: 12,
                    teto: 10,
                    percentual: 120,
                    semana: iso(segundaQueVem),
                });
                // Gravada no dia, sem a hora
                const gravada = await ctx.factory.criarTarefaRepository().buscarPorCodigo(r.corpo.codigo);
                expect(gravada!.dataInicio.toISOString()).toBe(`${iso(segundaQueVem)}T00:00:00.000Z`);
                expect(gravada!.dataFim.toISOString()).toBe(`${iso(sextaQueVem)}T00:00:00.000Z`);
            });

            it("PUT só do título com as mesmas datas às 15:00Z: avisosOcupacao vazio", async () => {
                const criada = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoSemanaQueVem() });
                expect(criada.corpo.avisosOcupacao).toHaveLength(1);
                const r = await servidor.chamar("put", `/tarefas/${criada.corpo.codigo}`, {
                    usuario: ctx.gerente,
                    corpo: corpoSemanaQueVem({ titulo: "Só o título" }),
                });
                expect(r.status).toBe(200);
                expect(r.corpo.titulo).toBe("Só o título");
                expect(r.corpo.avisosOcupacao).toEqual([]);
            });

            it("o número do aviso é o mesmo do GET /ocupacao e do detalhe na mesma semana", async () => {
                const criada = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoSemanaQueVem() });
                const aviso = criada.corpo.avisosOcupacao[0];
                const todas = await servidor.chamar("get", `/ocupacao?semana=${aviso.semana}`, { usuario: diretor });
                const total = todas.corpo.find((p: any) => p.codigoUsuario === assessor.codigo);
                expect({ horas: total.horas, percentual: total.percentual }).toEqual({ horas: aviso.horas, percentual: aviso.percentual });
                const detalhe = await servidor.chamar("get", `/ocupacao/${assessor.codigo}?semana=${aviso.semana}`, { usuario: diretor });
                expect({ horas: detalhe.corpo.horas, percentual: detalhe.corpo.percentual }).toEqual({
                    horas: aviso.horas,
                    percentual: aviso.percentual,
                });
            });
        });

        it("datas ausentes: 400 com o campo", async () => {
            const r = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoTarefa({ dataFim: undefined }) });
            expect(r.status).toBe(400);
            expect(r.corpo.codigo).toBe("CAMPO_OBRIGATORIO");
        });

        it("falha no cálculo do aviso não vira 500: a tarefa fica gravada e avisosOcupacao vem vazio", async () => {
            const erro = jest.spyOn(console, "error").mockImplementation(() => undefined);
            const horas = ctx.factory.criarHorasDificuldadeRepository();
            jest.spyOn(ctx.factory, "criarHorasDificuldadeRepository").mockReturnValue(
                Object.assign(Object.create(Object.getPrototypeOf(horas)), horas, {
                    listar: async () => {
                        throw new Error("banco fora");
                    },
                }),
            );
            const r = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoTarefa() });
            expect(r.status).toBe(200);
            expect(r.corpo.avisosOcupacao).toEqual([]);
            expect(await ctx.factory.criarTarefaRepository().buscarPorCodigo(r.corpo.codigo)).not.toBeNull();
            expect(erro).toHaveBeenCalled();
            jest.restoreAllMocks();
        });
    });

    describe("ConsultarOcupacao (semana e teto)", () => {
        const auth = (u: Usuario) => ({ codigo: u.codigo, perfil: u.perfil });

        it("domingo 22h em São Paulo: a semana padrão é a de São Paulo (segunda 16/11), não a do UTC", async () => {
            // 23/11 01:00 UTC = domingo 22/11 22:00 em São Paulo
            const domingo = diaNoFuso(new Date("2026-11-23T01:00:00.000Z"));
            const r = await new ConsultarOcupacao(ctx.factory, () => domingo).dePessoa(auth(diretor), assessor.codigo);
            expect(r.semana).toBe("2026-11-16");
        });

        it("aviso só de semanas a partir da atual: sobrecarga só em semana passada não avisa; nesta semana, avisa com ela", async () => {
            const d = (t: string) => new Date(`${t}T00:00:00.000Z`);
            const quarta = d("2026-11-18");
            const usuarios = ctx.factory.criarUsuarioRepository();
            const passado = new Usuario(
                "Pedro Passado",
                "pedro@konvex.com.br",
                PerfilUsuario.MEMBRO,
                true,
                "x",
                ctx.senioridade,
                "usr-pedro",
            );
            const agora = new Usuario("Alice Agora", "alice@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-alice");
            await usuarios.criar(passado);
            await usuarios.criar(agora);
            const cargos = ctx.factory.criarCargoRepository();
            const apertado = await cargos.criar(new Cargo("Apertado", true, undefined, false, 1));
            const folgado = await cargos.criar(new Cargo("Folgado", true, undefined, false, 40));
            const periodos = ctx.factory.criarPeriodoAreaRepository();
            // Pedro: teto 1 até 02/11 (exclusivo), 40 depois: só as semanas passadas ficam acima de 100%.
            await periodos.criar(new PeriodoArea(passado.codigo, area, apertado, d("2026-10-01"), d("2026-11-02"), null));
            await periodos.criar(new PeriodoArea(passado.codigo, area, folgado, d("2026-11-02"), null, null));
            const tarefas = ctx.factory.criarTarefaRepository();
            const nova = (titulo: string, inicio: string, fim: string, dif: DificuldadeTarefa, resp: Usuario[]) =>
                new Tarefa(
                    normal,
                    titulo,
                    d(inicio),
                    d(fim),
                    StatusTarefa.PENDENTE,
                    PrioridadeTarefa.P2,
                    null,
                    null,
                    null,
                    resp,
                    [],
                    undefined,
                    null,
                    null,
                    null,
                    dif,
                );
            // Alice (teto 10) já tem 8 h + 4 h nesta semana.
            await tarefas.criar(nova("Esta semana 1", "2026-11-18", "2026-11-20", DificuldadeTarefa.DIFICIL, [agora]));
            await tarefas.criar(nova("Esta semana 2", "2026-11-18", "2026-11-20", DificuldadeTarefa.MEDIA, [agora]));
            // Começou 3 semanas atrás (26/10) e termina na próxima (27/11): 25 dias úteis, 1,6 h por semana.
            const longa = await tarefas.criar(nova("Longa", "2026-10-26", "2026-11-27", DificuldadeTarefa.DIFICIL, [passado, agora]));

            const avisos = await new ConsultarOcupacao(ctx.factory, () => quarta).avisos(null, longa);
            expect(avisos.map((a) => a.codigoUsuario)).toEqual([agora.codigo]);
            expect(avisos[0]).toMatchObject({ semana: "2026-11-16", horas: 13.6, teto: 10, percentual: 136 });
        });

        it("teto da semana vem do cargo vigente na segunda; dois cargos (dados antigos) = o maior", async () => {
            const periodos = ctx.factory.criarPeriodoAreaRepository();
            const presidente = await ctx.factory.criarCargoRepository().criar(new Cargo("Presidente", true, undefined, false, 20));
            const outra = await ctx.factory.criarAreaRepository().criar(new Area("Presidência"));
            // De fev a mar/2025 foi presidente (teto 20); sem período hoje no fim de 2024.
            await periodos.criar(
                new PeriodoArea(
                    assessor.codigo,
                    outra,
                    presidente,
                    new Date("2025-02-03T00:00:00.000Z"),
                    new Date("2025-03-03T00:00:00.000Z"),
                    null,
                ),
            );
            const consulta = new ConsultarOcupacao(ctx.factory);
            const naPresidencia = await consulta.todas(new Date("2025-02-12T00:00:00.000Z"));
            expect(naPresidencia.find((p) => p.codigoUsuario === assessor.codigo)?.teto).toBe(20);
            // Segunda 03/03/2025: o período terminou (fim exclusivo) e o de assessor ainda não começou: sem cargo.
            const depois = await consulta.todas(new Date("2025-03-05T00:00:00.000Z"));
            expect(depois.find((p) => p.codigoUsuario === assessor.codigo)?.teto).toBe(10);

            // Dois cargos abertos ao mesmo tempo (dados de antes da regra): vale o maior.
            await periodos.criar(
                PeriodoArea.carregar(assessor.codigo, outra, presidente, new Date("2026-01-01T00:00:00.000Z"), null, null, "per-x"),
            );
            const agora = await consulta.dePessoa(auth(diretor), assessor.codigo, dia);
            expect(agora.teto).toBe(20);
            expect(agora.percentual).toBe(20);
        });
    });
});
