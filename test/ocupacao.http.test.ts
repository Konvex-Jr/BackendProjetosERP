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
import ConsultarOcupacao from "../source/useCases/tarefas/ConsultarOcupacao";
import { diaNoFuso, hoje } from "../source/shared/datas";
import { criarContexto } from "./fixtures";
import { subirServidor } from "./http/servidorTeste";
import { Papel, autenticado, comPapel } from "./papel";

const UM_DIA = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Sessão 24a: GET /ocupacao, detalhe por pessoa com sigilo e avisos ao salvar tarefa. */
describe("Ocupação semanal (HTTP)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let assessor: Usuario; // tem 1,5 h (Média de hoje: 75% de um dia de 2 h) no sigiloso nesta semana
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
        const novo = async (nome: string, perfil: Papel, codigo: string, status = StatusPessoa.ATIVO) => {
            const u = comPapel(new Usuario(nome, `${codigo}@konvex.com.br`, true, "x", ctx.senioridade, codigo, { status }), perfil);
            await usuarios.criar(u);
            return u;
        };
        assessor = await novo("Ivo Assessor", "membro", "usr-ivo");
        fora = await novo("Fê Fora", "membro", "usr-fe");
        diretor = await novo("Dora Diretora", "diretor", "usr-dora");
        trainee = await novo("Téo Trainee", "membro", "usr-teo", StatusPessoa.TRAINEE);
        alumni = await novo("Alu Alumni", "membro", "usr-alu", StatusPessoa.INATIVO);

        area = await ctx.factory.criarAreaRepository().criar(new Area("Projetos"));
        const cargo = await ctx.factory.criarCargoRepository().criar(new Cargo("Assessor", true, undefined, false, 10));
        await ctx.factory
            .criarPeriodoAreaRepository()
            .criar(new PeriodoArea(assessor.codigo, area, cargo, new Date("2026-01-01T00:00:00.000Z"), null, null));

        const projetos = ctx.factory.criarProjetoRepository();
        const inicio = new Date(dia.getTime() - 30 * UM_DIA);
        const fim = new Date(dia.getTime() + 60 * UM_DIA);
        const sigiloso = await projetos.criar(
            new Projeto("Projeto Secreto", "d", inicio, fim, undefined, [assessor], "p-sig", { criadoPor: "usr-dora" }),
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
                horas: 1.5,
                teto: 10,
                percentual: 15,
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
        it("membro de fora do sigiloso: linha do projeto com o nome, sem título (sessão 27b)", async () => {
            const r = await servidor.chamar("get", "/ocupacao/usr-ivo", { usuario: fora });
            expect(r.status).toBe(200);
            expect(r.corpo).toMatchObject({ codigoUsuario: "usr-ivo", horas: 1.5, teto: 10, percentual: 15 });
            expect(r.corpo.itens).toEqual([{ tipo: "projeto", projeto: { codigo: "p-sig", nome: "Projeto Secreto" }, horas: 1.5 }]);
            const texto = JSON.stringify(r.corpo);
            expect(texto).not.toContain("Título secreto");
            expect(texto).not.toContain("titulo");
            expect(texto).not.toContain("t-sig");
        });

        it("gerente fora do sigiloso: linha do projeto com o nome, sem título", async () => {
            comPapel(ctx.gerente, "gerenteDaArea");
            const r = await servidor.chamar("get", "/ocupacao/usr-ivo", { usuario: ctx.gerente });
            expect(r.corpo.itens).toEqual([{ tipo: "projeto", projeto: { codigo: "p-sig", nome: "Projeto Secreto" }, horas: 1.5 }]);
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
                    horas: 1.5,
                },
            ]);
            expect(r.corpo.semana).toBe(iso(new Date(dia.getTime() - ((dia.getUTCDay() + 6) % 7) * UM_DIA)));
        });
    });

    describe("avisos ao salvar tarefa", () => {
        // Semana que vem inteira: futura em qualquer dia da semana em que o teste rodar.
        const segundaQueVem = new Date(dia.getTime() + (7 - ((dia.getUTCDay() + 6) % 7)) * UM_DIA);
        const sextaQueVem = new Date(segundaQueVem.getTime() + 4 * UM_DIA);
        const corpoTarefa = (extra: Record<string, unknown> = {}) => ({
            codigoProjeto: "p-nor",
            titulo: "Relatório final",
            dataInicio: iso(segundaQueVem),
            dataFim: iso(sextaQueVem),
            prioridade: "P2",
            status: "pendente",
            dificuldade: "dificil",
            codigosResponsaveis: [assessor.codigo],
            ...extra,
        });

        beforeEach(async () => {
            // Já tem uma Média na segunda da semana que vem: 75% de um dia de 2 h = 1,5 h.
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

        it("POST de tarefa Difícil de segunda a sexta para assessor com 1,5 h na segunda: aviso de 115%", async () => {
            const r = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoTarefa() });
            expect(r.status).toBe(200);
            expect(r.corpo.titulo).toBe("Relatório final");
            expect(r.corpo.quantidadeAnexos).toBe(0);
            expect(r.corpo.avisosOcupacao).toHaveLength(1);
            expect(r.corpo.avisosOcupacao[0]).toMatchObject({
                codigoUsuario: assessor.codigo,
                nome: "Ivo Assessor",
                horas: 11.5,
                teto: 10,
                percentual: 115,
                semana: iso(segundaQueVem),
            });
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
            expect(r.corpo.avisosOcupacao.map((a: any) => a.percentual)).toEqual([115]);
        });

        it("PATCH coluna que reabre tarefa concluída e passa de 100%: aviso", async () => {
            await ctx.factory
                .criarTarefaRepository()
                .criar(
                    new Tarefa(
                        normal,
                        "Concluída",
                        segundaQueVem,
                        sextaQueVem,
                        StatusTarefa.CONCLUIDA,
                        PrioridadeTarefa.P2,
                        null,
                        dia,
                        null,
                        [assessor],
                        [],
                        "t-conc",
                        null,
                        null,
                        null,
                        DificuldadeTarefa.DIFICIL,
                    ),
                );
            const r = await servidor.chamar("patch", "/tarefas/t-conc/coluna", {
                usuario: ctx.gerente,
                corpo: { codigoColuna: normal.colunaDeEntrada.codigo },
            });
            expect(r.status).toBe(200);
            expect(r.corpo.status).toBe("pendente");
            expect(r.corpo.avisosOcupacao).toHaveLength(1);
            expect(r.corpo.avisosOcupacao[0]).toMatchObject({ codigoUsuario: assessor.codigo, percentual: 115 });
        });

        it("PATCH status que conclui: avisosOcupacao vazio", async () => {
            await ctx.factory.criarTarefaRepository().criar(novaTarefa(normal, "Aberta", DificuldadeTarefa.DIFICIL, undefined, "t-ab"));
            const r = await servidor.chamar("patch", "/tarefas/t-ab/status", { usuario: ctx.gerente, corpo: { status: "concluida" } });
            expect(r.status).toBe(200);
            expect(r.corpo.avisosOcupacao).toEqual([]);
        });

        describe("datas com hora (a tela manda meio-dia local, 15:00Z)", () => {
            const as15 = (d: Date) => `${iso(d)}T15:00:00.000Z`;
            const corpoSemanaQueVem = (extra: Record<string, unknown> = {}) =>
                corpoTarefa({ dataInicio: as15(segundaQueVem), dataFim: as15(sextaQueVem), ...extra });

            it("Difícil de segunda a sexta da semana que vem: aviso de 115% (nenhum dia perdido)", async () => {
                const r = await servidor.chamar("post", "/tarefas", { usuario: ctx.gerente, corpo: corpoSemanaQueVem() });
                expect(r.status).toBe(200);
                expect(r.corpo.avisosOcupacao).toHaveLength(1);
                expect(r.corpo.avisosOcupacao[0]).toMatchObject({
                    codigoUsuario: assessor.codigo,
                    horas: 11.5,
                    teto: 10,
                    percentual: 115,
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
        const auth = (u: Usuario) => autenticado(u);

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
            const passado = comPapel(
                new Usuario("Pedro Passado", "pedro@konvex.com.br", true, "x", ctx.senioridade, "usr-pedro"),
                "membro",
            );
            const agora = comPapel(new Usuario("Alice Agora", "alice@konvex.com.br", true, "x", ctx.senioridade, "usr-alice"), "membro");
            await usuarios.criar(passado);
            await usuarios.criar(agora);
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
            // Ambos sem cargo (teto 10, dia de 2 h). Pedro: Difícil de 02/11 até hoje (quarta 18/11): 5 dias (10 h) na
            // semana de 02/11 e 3 dias (segunda a quarta, 6 h) nesta. (Atrasada não serviria: só conta na semana atual.)
            await tarefas.criar(nova("Desde 02/11", "2026-11-02", "2026-11-18", DificuldadeTarefa.DIFICIL, [passado]));
            // Alice: Difícil de segunda a sexta desta semana (10 h).
            await tarefas.criar(nova("Esta semana", "2026-11-16", "2026-11-20", DificuldadeTarefa.DIFICIL, [agora]));
            // Rápida de 26/10 a 27/11: 25% de 2 h = 0,5 h por dia útil, 2,5 h em cada semana inteira, para os dois.
            // Pedro: 12,5 h (125%) só na semana de 02/11 (passada); 8,5 h (85%) nesta: sem aviso.
            // Alice: 2,5 h + 10 h = 12,5 h (125%) nesta semana; 2,5 h na próxima.
            const longa = await tarefas.criar(nova("Longa", "2026-10-26", "2026-11-27", DificuldadeTarefa.RAPIDA, [passado, agora]));

            const avisos = await new ConsultarOcupacao(ctx.factory, () => quarta).avisos(null, longa);
            expect(avisos.map((a) => a.codigoUsuario)).toEqual([agora.codigo]);
            expect(avisos[0]).toMatchObject({ semana: "2026-11-16", horas: 12.5, teto: 10, percentual: 125 });
            // A semana passada de Pedro estava mesmo acima de 100% (o aviso só a ignora por ser passada).
            const consulta = new ConsultarOcupacao(ctx.factory, () => quarta);
            expect(await consulta.dePessoa(auth(diretor), passado.codigo, d("2026-11-02"))).toMatchObject({ horas: 12.5, percentual: 125 });
            expect(await consulta.dePessoa(auth(diretor), passado.codigo, quarta)).toMatchObject({ horas: 8.5, percentual: 85 });
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
            // Média de hoje com teto 20: 75% de um dia de 4 h = 3 h (15%).
            expect(agora).toMatchObject({ teto: 20, horas: 3, percentual: 15 });
        });
    });
});
