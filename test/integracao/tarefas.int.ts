/**
 * Integração das tarefas contra PostgreSQL de verdade.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import Usuario from "../../source/domain/entity/Usuario";
import SenioridadeUsuario from "../../source/domain/entity/SenioridadeUsuario";
import Projeto from "../../source/domain/entity/Projeto";
import Tarefa from "../../source/domain/entity/Tarefa";
import StatusTarefa from "../../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../../source/domain/enum/PrioridadeTarefa";
import DificuldadeTarefa from "../../source/domain/enum/DificuldadeTarefa";
import Cargo from "../../source/domain/entity/Cargo";
import CriarTarefa from "../../source/useCases/tarefas/CriarTarefa";
import EditarTarefa from "../../source/useCases/tarefas/EditarTarefa";
import { Papel, comPapel } from "../papel";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;

descrever("tarefas contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let factory: DatabaseRepositoryFactory;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        conexao = PgConexao.criar(URL_TESTE!);
        factory = new DatabaseRepositoryFactory(conexao);
    }, 60000);

    afterAll(async () => {
        await conexao?.encerrar();
        await pool?.end();
    });

    test("responsável que saiu da equipe não impede listar, abrir nem editar a tarefa", async () => {
        const inicio = new Date("2026-10-12T00:00:00.000Z");
        const fim = new Date("2026-10-30T00:00:00.000Z");
        const pessoa = comPapel(
            new Usuario(
                "Saiu do Projeto",
                `saiu-${crypto.randomUUID()}@teste.com`,
                true,
                "hash",
                new SenioridadeUsuario("pleno", "Pleno", 75),
            ),
            "membro",
        );
        await factory.criarUsuarioRepository().criar(pessoa);
        const projeto = await factory
            .criarProjetoRepository()
            .criar(new Projeto("Projeto", "Descrição", inicio, fim, undefined, [pessoa], crypto.randomUUID()));
        const tarefas = factory.criarTarefaRepository();
        const tarefa = await tarefas.criar(
            new Tarefa(projeto, "Tarefa", inicio, fim, StatusTarefa.PENDENTE, PrioridadeTarefa.P2, null, null, null, [pessoa], []),
        );
        // A pessoa sai do projeto, mas continua responsável pela tarefa.
        await pool.query("UPDATE projeto_membros SET data_saida = data_entrada WHERE projeto_codigo = $1", [projeto.codigo]);

        const lista = await tarefas.listar();
        expect(lista.map((t) => t.codigo)).toContain(tarefa.codigo);
        const aberta = await tarefas.buscarPorCodigo(tarefa.codigo);
        expect(aberta?.responsaveis.map((r) => r.codigo)).toEqual([pessoa.codigo]);

        const editada = await new EditarTarefa(factory).execute({
            codigo: tarefa.codigo,
            titulo: "Tarefa editada",
            dataInicio: inicio,
            dataFim: fim,
            status: StatusTarefa.CONCLUIDA,
            prioridade: PrioridadeTarefa.P1,
            descricao: null,
            codigosResponsaveis: [pessoa.codigo],
            quem: pessoa,
        });
        expect(editada.titulo).toBe("Tarefa editada");
        expect(editada.responsaveis.map((r) => r.codigo)).toEqual([pessoa.codigo]);
    });

    test("checklist: responsável do item grava e lê; marcar na hora; PUT não desfaz a marcação", async () => {
        const inicio = new Date("2026-10-12T00:00:00.000Z");
        const fim = new Date("2026-10-30T00:00:00.000Z");
        const pessoa = comPapel(
            new Usuario("Item", `item-${crypto.randomUUID()}@teste.com`, true, "hash", new SenioridadeUsuario("pleno", "Pleno", 75)),
            "membro",
        );
        await factory.criarUsuarioRepository().criar(pessoa);
        const projeto = await factory
            .criarProjetoRepository()
            .criar(new Projeto("Projeto Item", "Descrição", inicio, fim, undefined, [pessoa], crypto.randomUUID()));
        const tarefas = factory.criarTarefaRepository();
        const criada = await new CriarTarefa(factory).execute({
            codigoProjeto: projeto.codigo,
            titulo: "Com itens",
            dataInicio: inicio,
            dataFim: fim,
            codigosResponsaveis: [pessoa.codigo],
            checklist: [
                { texto: "Meu", feito: false, codigoResponsavel: pessoa.codigo },
                { texto: "De ninguém", feito: true },
            ],
        });
        const lida = (await tarefas.buscarPorCodigo(criada.codigo))!;
        expect(lida.checklist.map((i) => [i.texto, i.feito, i.responsavel?.codigo ?? null])).toEqual([
            ["Meu", false, pessoa.codigo],
            ["De ninguém", true, null],
        ]);
        expect(await tarefas.marcarItem(criada.codigo, lida.checklist[0].codigo, true)).toBe(true);
        expect(await tarefas.marcarItem(criada.codigo, crypto.randomUUID(), true)).toBe(false);
        const editada = await new EditarTarefa(factory).execute({
            codigo: criada.codigo,
            titulo: "Com itens",
            dataInicio: inicio,
            dataFim: fim,
            status: StatusTarefa.PENDENTE,
            prioridade: PrioridadeTarefa.P2,
            codigosResponsaveis: [pessoa.codigo],
            checklist: lida.checklist.map((i) => ({ codigo: i.codigo, texto: i.texto, feito: false, codigoResponsavel: pessoa.codigo })),
        });
        expect(editada.checklist.map((i) => i.feito)).toEqual([true, true]);
        expect((await tarefas.buscarPorCodigo(criada.codigo))!.checklist.map((i) => i.feito)).toEqual([true, true]);
    });

    test("dificuldade da tarefa, horas por nível e teto do cargo gravam e leem", async () => {
        const inicio = new Date("2026-10-12T00:00:00.000Z");
        const fim = new Date("2026-10-30T00:00:00.000Z");
        const pessoa = comPapel(
            new Usuario("Dificuldade", `dif-${crypto.randomUUID()}@teste.com`, true, "hash", new SenioridadeUsuario("pleno", "Pleno", 75)),
            "membro",
        );
        await factory.criarUsuarioRepository().criar(pessoa);
        const projeto = await factory
            .criarProjetoRepository()
            .criar(new Projeto("Projeto Dif", "Descrição", inicio, fim, undefined, [pessoa], crypto.randomUUID()));
        const tarefas = factory.criarTarefaRepository();
        const criada = await tarefas.criar(
            new Tarefa(
                projeto,
                "Com dificuldade",
                inicio,
                fim,
                StatusTarefa.PENDENTE,
                PrioridadeTarefa.P2,
                null,
                null,
                null,
                [pessoa],
                [],
                undefined,
                null,
                null,
                null,
                DificuldadeTarefa.MEDIA,
            ),
        );
        expect((await tarefas.buscarPorCodigo(criada.codigo))?.dificuldade).toBe("media");
        const limpa = await new EditarTarefa(factory).execute({
            codigo: criada.codigo,
            titulo: "Com dificuldade",
            dataInicio: inicio,
            dataFim: fim,
            status: StatusTarefa.PENDENTE,
            prioridade: PrioridadeTarefa.P2,
            codigosResponsaveis: [pessoa.codigo],
            dificuldade: null,
        });
        expect(limpa.dificuldade).toBeNull();
        expect((await tarefas.buscarPorCodigo(criada.codigo))?.dificuldade).toBeNull();

        const horas = factory.criarHorasDificuldadeRepository();
        expect(await horas.listar()).toEqual({ rapida: 25, facil: 50, media: 75, dificil: 100 });
        await horas.salvar({ rapida: 5, facil: 30, media: 60, dificil: 100 });
        expect(await horas.listar()).toEqual({ rapida: 5, facil: 30, media: 60, dificil: 100 });

        const cargos = factory.criarCargoRepository();
        const cargo = await cargos.criar(new Cargo(`Cargo ${crypto.randomUUID()}`, true, undefined, false, 15));
        expect((await cargos.buscarPorCodigo(cargo.codigo))?.tetoSemanalHoras).toBe(15);
        await cargos.editar(new Cargo(cargo.nome, true, cargo.codigo, false, 20));
        expect((await cargos.buscarPorCodigo(cargo.codigo))?.tetoSemanalHoras).toBe(20);
    });

    test("GET /tarefas pelo banco: tarefa de projeto sigiloso só para quem tem acesso completo", async () => {
        const { subirServidor } = await import("../http/servidorTeste");
        const inicio = new Date("2026-10-12T00:00:00.000Z");
        const fim = new Date("2026-10-30T00:00:00.000Z");
        const criar = async (nome: string, perfil: Papel) => {
            const u = comPapel(
                new Usuario(nome, `${crypto.randomUUID()}@teste.com`, true, "hash", new SenioridadeUsuario("pleno", "Pleno", 75)),
                perfil,
            );
            await factory.criarUsuarioRepository().criar(u);
            return u;
        };
        const equipe = await criar("Equipe Sigilo", "membro");
        const gerenteFora = await criar("Gerente Fora", "gerenteDaArea");
        const projeto = await factory
            .criarProjetoRepository()
            .criar(new Projeto("Sigiloso", "Descrição", inicio, fim, undefined, [equipe], crypto.randomUUID(), { criadoPor: null }));
        const tarefa = await factory
            .criarTarefaRepository()
            .criar(new Tarefa(projeto, "Segredo", inicio, fim, StatusTarefa.PENDENTE, PrioridadeTarefa.P2, null, null, null, [equipe], []));
        const servidor = await subirServidor(factory);
        try {
            const doGerente = await servidor.chamar("get", "/tarefas", { usuario: gerenteFora });
            expect(doGerente.status).toBe(200);
            expect(doGerente.corpo.map((t: any) => t.codigo)).not.toContain(tarefa.codigo);
            const daEquipe = await servidor.chamar("get", "/tarefas", { usuario: equipe });
            expect(daEquipe.corpo.map((t: any) => t.codigo)).toContain(tarefa.codigo);
            // Sessão 27a: o gerente fora do sigiloso recebe o mesmo 404 da tarefa inexistente (antes, 403).
            expect((await servidor.chamar("get", `/tarefas/${tarefa.codigo}/comentarios`, { usuario: gerenteFora })).status).toBe(404);
        } finally {
            await servidor.fechar();
        }
    });

    test("contarPorProjetos conta total, concluídas, atrasadas e da semana (hoje = quarta 18/11)", async () => {
        const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);
        const pessoa = comPapel(
            new Usuario(
                "Conta Tarefas",
                `conta-${crypto.randomUUID()}@teste.com`,
                true,
                "hash",
                new SenioridadeUsuario("pleno", "Pleno", 75),
            ),
            "membro",
        );
        await factory.criarUsuarioRepository().criar(pessoa);
        const projeto = await factory
            .criarProjetoRepository()
            .criar(new Projeto("Contagem", "Descrição", dia("2026-11-01"), dia("2026-12-30"), undefined, [pessoa], crypto.randomUUID()));
        const tarefas = factory.criarTarefaRepository();
        const nova = (fim: string, status: StatusTarefa) =>
            tarefas.criar(
                new Tarefa(
                    projeto,
                    "T",
                    dia("2026-11-01"),
                    dia(fim),
                    status,
                    PrioridadeTarefa.P2,
                    null,
                    status === StatusTarefa.CONCLUIDA ? dia(fim) : null,
                    null,
                    [pessoa],
                    [],
                ),
            );
        await nova("2026-11-17", StatusTarefa.PENDENTE);
        await nova("2026-11-22", StatusTarefa.PENDENTE);
        await nova("2026-11-23", StatusTarefa.PENDENTE);
        await nova("2026-11-10", StatusTarefa.CONCLUIDA);

        const mapa = await tarefas.contarPorProjetos([projeto.codigo, "sem-tarefas"], dia("2026-11-18"));
        expect(mapa.get(projeto.codigo)).toEqual({ total: 4, concluidas: 1, atrasadas: 1, semana: 1 });
        expect(mapa.get("sem-tarefas")).toEqual({ total: 0, concluidas: 0, atrasadas: 0, semana: 0 });
    });

    test("ocupação pelo banco: GET /ocupacao, detalhe sem título do sigiloso e aviso ao criar tarefa", async () => {
        const { subirServidor } = await import("../http/servidorTeste");
        const { hoje } = await import("../../source/shared/datas");
        const Area = (await import("../../source/domain/entity/Area")).default;
        const PeriodoArea = (await import("../../source/domain/entity/PeriodoArea")).default;
        // O teste de % por nível acima grava outros valores no mesmo banco.
        await factory.criarHorasDificuldadeRepository().salvar({ rapida: 25, facil: 50, media: 75, dificil: 100 });
        const dia = hoje();
        const inicio = new Date(dia.getTime() - 30 * 86_400_000);
        const fim = new Date(dia.getTime() + 60 * 86_400_000);
        const criar = async (nome: string, perfil: Papel) => {
            const u = comPapel(
                new Usuario(nome, `${crypto.randomUUID()}@teste.com`, true, "hash", new SenioridadeUsuario("pleno", "Pleno", 75)),
                perfil,
            );
            await factory.criarUsuarioRepository().criar(u);
            return u;
        };
        const assessor = await criar("Assessor Ocupado", "membro");
        const fora = await criar("Membro Fora", "membro");
        const gerente = await criar("Gerente Ocupação", "gerenteDaArea");
        const area = await factory.criarAreaRepository().criar(new Area(`Área ${crypto.randomUUID()}`));
        const cargo = await factory.criarCargoRepository().criar(new Cargo(`Assessor ${crypto.randomUUID()}`, true, undefined, false, 10));
        await factory.criarPeriodoAreaRepository().criar(new PeriodoArea(assessor.codigo, area, cargo, inicio, null, null));
        const projetos = factory.criarProjetoRepository();
        const sigiloso = await projetos.criar(
            new Projeto("Sigiloso Ocupação", "d", inicio, fim, undefined, [assessor], crypto.randomUUID(), { criadoPor: null }),
        );
        const normal = await projetos.criar(new Projeto("Normal Ocupação", "d", inicio, fim, undefined, [assessor], crypto.randomUUID()));
        await factory
            .criarTarefaRepository()
            .criar(
                new Tarefa(
                    sigiloso,
                    "Segredo da ocupação",
                    dia,
                    dia,
                    StatusTarefa.PENDENTE,
                    PrioridadeTarefa.P2,
                    null,
                    null,
                    null,
                    [assessor],
                    [],
                    undefined,
                    null,
                    null,
                    null,
                    DificuldadeTarefa.MEDIA,
                ),
            );
        const servidor = await subirServidor(factory);
        try {
            const todas = await servidor.chamar("get", "/ocupacao", { usuario: fora });
            expect(todas.status).toBe(200);
            expect(todas.corpo.find((p: any) => p.codigoUsuario === assessor.codigo)).toEqual({
                codigoUsuario: assessor.codigo,
                nome: "Assessor Ocupado",
                horas: 1.5,
                teto: 10,
                percentual: 15,
            });
            const detalhe = await servidor.chamar("get", `/ocupacao/${assessor.codigo}`, { usuario: fora });
            // Sessão 27b: quem está fora também vê o nome do projeto (sem o título da tarefa).
            expect(detalhe.corpo.itens).toEqual([
                { tipo: "projeto", projeto: { codigo: sigiloso.codigo, nome: "Sigiloso Ocupação" }, horas: 1.5 },
            ]);
            expect(JSON.stringify(detalhe.corpo)).not.toContain("Segredo");
            const doGerente = await servidor.chamar("get", `/ocupacao/${assessor.codigo}`, { usuario: gerente });
            expect(doGerente.corpo.itens).toEqual([
                { tipo: "projeto", projeto: { codigo: sigiloso.codigo, nome: "Sigiloso Ocupação" }, horas: 1.5 },
            ]);

            // Semana que vem (futura em qualquer dia): já tem uma Média na segunda (1,5 h); a Difícil de segunda a
            // sexta soma 5 dias × 2 h = 10 h: 11,5 h sobre o teto de 10 h = 115%.
            const segundaQueVem = new Date(dia.getTime() + (7 - ((dia.getUTCDay() + 6) % 7)) * 86_400_000);
            const sextaQueVem = new Date(segundaQueVem.getTime() + 4 * 86_400_000);
            await factory
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
                        undefined,
                        null,
                        null,
                        null,
                        DificuldadeTarefa.MEDIA,
                    ),
                );
            // Para criar no projeto normal, a gestão precisa abri-lo (31a): passa a abrir todos.
            comPapel(gerente, "gerente");
            const criada = await servidor.chamar("post", "/tarefas", {
                usuario: gerente,
                corpo: {
                    codigoProjeto: normal.codigo,
                    titulo: "Pesada",
                    dataInicio: segundaQueVem.toISOString().slice(0, 10),
                    dataFim: sextaQueVem.toISOString().slice(0, 10),
                    prioridade: "P2",
                    dificuldade: "dificil",
                    codigosResponsaveis: [assessor.codigo],
                },
            });
            expect(criada.status).toBe(200);
            expect(criada.corpo.avisosOcupacao).toEqual([
                expect.objectContaining({
                    codigoUsuario: assessor.codigo,
                    horas: 11.5,
                    teto: 10,
                    percentual: 115,
                    semana: segundaQueVem.toISOString().slice(0, 10),
                }),
            ]);
        } finally {
            await servidor.fechar();
        }
    });
    test("avisos pelo banco: tarefa recebida na criação e na edição, capacitação nova para ativos na EJ", async () => {
        const { subirServidor } = await import("../http/servidorTeste");
        const { hoje } = await import("../../source/shared/datas");
        const dia = hoje();
        const inicio = new Date(dia.getTime() - 30 * 86_400_000);
        const fim = new Date(dia.getTime() + 60 * 86_400_000);
        const criar = async (nome: string, perfil: Papel) => {
            const u = comPapel(
                new Usuario(nome, `${crypto.randomUUID()}@teste.com`, true, "hash", new SenioridadeUsuario("pleno", "Pleno", 75)),
                perfil,
            );
            await factory.criarUsuarioRepository().criar(u);
            return u;
        };
        const alvo = await criar("Alvo do Aviso", "membro");
        const autor = await criar("Autor do Aviso", "diretor");
        const projeto = await factory
            .criarProjetoRepository()
            .criar(new Projeto("Projeto Avisos", "d", inicio, fim, undefined, [alvo], crypto.randomUUID()));
        const servidor = await subirServidor(factory);
        try {
            const dataTarefa = dia.toISOString().slice(0, 10);
            const corpo = {
                codigoProjeto: projeto.codigo,
                titulo: "Com aviso",
                dataInicio: dataTarefa,
                dataFim: dataTarefa,
                prioridade: "P2",
                codigosResponsaveis: [alvo.codigo],
                status: "pendente",
            };
            const criada = await servidor.chamar("post", "/tarefas", { usuario: autor, corpo });
            expect(criada.status).toBe(200);
            const linhas = async () =>
                (
                    await pool.query("SELECT autor_codigo FROM avisos WHERE usuario_codigo = $1 AND tarefa_codigo = $2", [
                        alvo.codigo,
                        criada.corpo.codigo,
                    ])
                ).rows;
            expect(await linhas()).toEqual([{ autor_codigo: autor.codigo }]);
            const editada = await servidor.chamar("put", `/tarefas/${criada.corpo.codigo}`, { usuario: autor, corpo });
            expect(editada.status).toBe(200);
            expect(await linhas()).toHaveLength(1);

            const cap = await servidor.chamar("post", "/capacitacoes", {
                usuario: autor,
                corpo: {
                    titulo: "Capacitação com aviso",
                    data: "2099-01-10",
                    hora: "18:00",
                    codigoInstrutor: autor.codigo,
                    vagas: 5,
                    tipo: "computacao",
                    sala: "X",
                },
            });
            expect(cap.status).toBe(200);
            const esperado = (
                await pool.query("SELECT count(*)::int AS n FROM usuarios WHERE status IN ('ativo','trainee') AND codigo <> $1", [
                    autor.codigo,
                ])
            ).rows[0].n;
            const gravados = await pool.query("SELECT usuario_codigo FROM avisos WHERE capacitacao_codigo = $1", [cap.corpo.codigo]);
            expect(gravados.rows).toHaveLength(esperado);
            expect(gravados.rows.map((r: any) => r.usuario_codigo)).toContain(alvo.codigo);
            expect(gravados.rows.map((r: any) => r.usuario_codigo)).not.toContain(autor.codigo);
        } finally {
            await servidor.fechar();
        }
    });
});
