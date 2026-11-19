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
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import StatusTarefa from "../../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../../source/domain/enum/PrioridadeTarefa";
import DificuldadeTarefa from "../../source/domain/enum/DificuldadeTarefa";
import Cargo from "../../source/domain/entity/Cargo";
import EditarTarefa from "../../source/useCases/tarefas/EditarTarefa";

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
        const pessoa = new Usuario(
            "Saiu do Projeto",
            `saiu-${crypto.randomUUID()}@teste.com`,
            PerfilUsuario.MEMBRO,
            true,
            "hash",
            new SenioridadeUsuario("pleno", "Pleno", 75),
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

    test("dificuldade da tarefa, horas por nível e teto do cargo gravam e leem", async () => {
        const inicio = new Date("2026-10-12T00:00:00.000Z");
        const fim = new Date("2026-10-30T00:00:00.000Z");
        const pessoa = new Usuario(
            "Dificuldade",
            `dif-${crypto.randomUUID()}@teste.com`,
            PerfilUsuario.MEMBRO,
            true,
            "hash",
            new SenioridadeUsuario("pleno", "Pleno", 75),
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
        expect(await horas.listar()).toEqual({ rapida: 1, facil: 2, media: 4, dificil: 8 });
        await horas.salvar({ rapida: 0.5, facil: 2.5, media: 5, dificil: 12 });
        expect(await horas.listar()).toEqual({ rapida: 0.5, facil: 2.5, media: 5, dificil: 12 });

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
        const criar = async (nome: string, perfil: PerfilUsuario) => {
            const u = new Usuario(
                nome,
                `${crypto.randomUUID()}@teste.com`,
                perfil,
                true,
                "hash",
                new SenioridadeUsuario("pleno", "Pleno", 75),
            );
            await factory.criarUsuarioRepository().criar(u);
            return u;
        };
        const equipe = await criar("Equipe Sigilo", PerfilUsuario.MEMBRO);
        const gerenteFora = await criar("Gerente Fora", PerfilUsuario.GERENTE);
        const projeto = await factory.criarProjetoRepository().criar(
            new Projeto("Sigiloso", "Descrição", inicio, fim, undefined, [equipe], crypto.randomUUID(), {
                sigiloso: true,
                criadoPor: null,
                acesso: [],
            }),
        );
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
            expect((await servidor.chamar("get", `/tarefas/${tarefa.codigo}/comentarios`, { usuario: gerenteFora })).status).toBe(403);
        } finally {
            await servidor.fechar();
        }
    });

    test("contarPorProjetos conta total, concluídas, atrasadas e da semana (hoje = quarta 18/11)", async () => {
        const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);
        const pessoa = new Usuario(
            "Conta Tarefas",
            `conta-${crypto.randomUUID()}@teste.com`,
            PerfilUsuario.MEMBRO,
            true,
            "hash",
            new SenioridadeUsuario("pleno", "Pleno", 75),
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
        // O teste de horas por nível acima grava outros valores no mesmo banco.
        await factory.criarHorasDificuldadeRepository().salvar({ rapida: 1, facil: 2, media: 4, dificil: 8 });
        const dia = hoje();
        const inicio = new Date(dia.getTime() - 30 * 86_400_000);
        const fim = new Date(dia.getTime() + 60 * 86_400_000);
        const criar = async (nome: string, perfil: PerfilUsuario) => {
            const u = new Usuario(
                nome,
                `${crypto.randomUUID()}@teste.com`,
                perfil,
                true,
                "hash",
                new SenioridadeUsuario("pleno", "Pleno", 75),
            );
            await factory.criarUsuarioRepository().criar(u);
            return u;
        };
        const assessor = await criar("Assessor Ocupado", PerfilUsuario.MEMBRO);
        const fora = await criar("Membro Fora", PerfilUsuario.MEMBRO);
        const gerente = await criar("Gerente Ocupação", PerfilUsuario.GERENTE);
        const area = await factory.criarAreaRepository().criar(new Area(`Área ${crypto.randomUUID()}`));
        const cargo = await factory.criarCargoRepository().criar(new Cargo(`Assessor ${crypto.randomUUID()}`, true, undefined, false, 10));
        await factory.criarPeriodoAreaRepository().criar(new PeriodoArea(assessor.codigo, area, cargo, inicio, null, null));
        const projetos = factory.criarProjetoRepository();
        const sigiloso = await projetos.criar(
            new Projeto("Sigiloso Ocupação", "d", inicio, fim, undefined, [assessor], crypto.randomUUID(), {
                sigiloso: true,
                criadoPor: null,
                acesso: [],
            }),
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
                horas: 4,
                teto: 10,
                percentual: 40,
            });
            const detalhe = await servidor.chamar("get", `/ocupacao/${assessor.codigo}`, { usuario: fora });
            expect(detalhe.corpo.itens).toEqual([{ tipo: "outras", horas: 4 }]);
            expect(JSON.stringify(detalhe.corpo)).not.toContain("Segredo");
            const doGerente = await servidor.chamar("get", `/ocupacao/${assessor.codigo}`, { usuario: gerente });
            expect(doGerente.corpo.itens).toEqual([
                { tipo: "projeto", projeto: { codigo: sigiloso.codigo, nome: "Sigiloso Ocupação" }, horas: 4 },
            ]);

            const criada = await servidor.chamar("post", "/tarefas", {
                usuario: gerente,
                corpo: {
                    codigoProjeto: normal.codigo,
                    titulo: "Pesada",
                    dataInicio: dia.toISOString().slice(0, 10),
                    dataFim: dia.toISOString().slice(0, 10),
                    prioridade: "P2",
                    dificuldade: "dificil",
                    codigosResponsaveis: [assessor.codigo],
                },
            });
            expect(criada.status).toBe(200);
            expect(criada.corpo.avisosOcupacao).toEqual([
                expect.objectContaining({ codigoUsuario: assessor.codigo, horas: 12, teto: 10, percentual: 120 }),
            ]);
        } finally {
            await servidor.fechar();
        }
    });
});
