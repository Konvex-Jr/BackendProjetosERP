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
});
