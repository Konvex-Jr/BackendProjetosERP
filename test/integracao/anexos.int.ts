/**
 * Integração dos anexos (contagem por dono) contra PostgreSQL de verdade.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import Anexo from "../../source/domain/entity/Anexo";
import { DonoAnexo } from "../../source/domain/enum/Anexo";
import AnexoRepositoryInterface from "../../source/domain/interfaces/AnexoRepositoryInterface";
import Usuario from "../../source/domain/entity/Usuario";
import SenioridadeUsuario from "../../source/domain/entity/SenioridadeUsuario";
import Projeto from "../../source/domain/entity/Projeto";
import Tarefa from "../../source/domain/entity/Tarefa";
import StatusTarefa from "../../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../../source/domain/enum/PrioridadeTarefa";
import GerirAnexos from "../../source/useCases/anexos/GerirAnexos";
import ExcluirProjeto from "../../source/useCases/projetos/ExcluirProjeto";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { autenticado, comPapel } from "../papel";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;

descrever("anexos contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let factory: DatabaseRepositoryFactory;
    let repo: AnexoRepositoryInterface;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        conexao = PgConexao.criar(URL_TESTE!);
        factory = new DatabaseRepositoryFactory(conexao);
        repo = factory.criarAnexoRepository();
    }, 60000);

    afterEach(async () => {
        await pool.query("DELETE FROM anexos");
    });

    afterAll(async () => {
        await conexao?.encerrar();
        await pool?.end();
    });

    const anexar = (donoCodigo: string, nome: string, donoTipo = DonoAnexo.TAREFA) =>
        repo.criar(new Anexo({ donoTipo, donoCodigo, nome, tamanhoBytes: 10, enviadoPor: null }));

    test("contarPorDonos conta por dono (2, 1 e 0) e só do tipo pedido", async () => {
        const [d1, d2, d3] = [1, 2, 3].map(() => crypto.randomUUID());
        await anexar(d1, "a.pdf");
        await anexar(d1, "b.pdf");
        await anexar(d2, "c.pdf");
        await anexar(d3, "outro-tipo.pdf", DonoAnexo.BIBLIOTECA);

        const mapa = await repo.contarPorDonos(DonoAnexo.TAREFA, [d1, d2, d3]);

        expect(mapa.get(d1)).toBe(2);
        expect(mapa.get(d2)).toBe(1);
        expect(mapa.get(d3) ?? 0).toBe(0);
    });

    test("contarPorDonos com lista vazia devolve mapa vazio", async () => {
        expect((await repo.contarPorDonos(DonoAnexo.TAREFA, [])).size).toBe(0);
    });

    test("exclui o projeto mesmo com tarefa de responsável que já saiu da equipe, levando os anexos das tarefas", async () => {
        const pasta = mkdtempSync(path.join(tmpdir(), "anexos-"));
        process.env.ANEXOS_DIR = pasta;
        try {
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
                .criar(new Projeto("Projeto a excluir", "Descrição", inicio, fim, undefined, [pessoa], crypto.randomUUID()));
            const tarefa = await factory
                .criarTarefaRepository()
                .criar(
                    new Tarefa(
                        projeto,
                        "Tarefa",
                        inicio,
                        fim,
                        StatusTarefa.PENDENTE,
                        PrioridadeTarefa.P2,
                        "Descrição",
                        null,
                        null,
                        [pessoa],
                        [],
                    ),
                );
            const anexo = await new GerirAnexos(factory).enviar(autenticado(pessoa), DonoAnexo.TAREFA, tarefa.codigo, {
                nome: "entrega.pdf",
                conteudo: Buffer.from("%PDF-1.4 teste"),
            });
            // A pessoa sai do projeto, mas continua responsável pela tarefa.
            await pool.query("UPDATE projeto_membros SET data_saida = data_entrada WHERE projeto_codigo = $1", [projeto.codigo]);
            const armazenamento = factory.criarArmazenamentoAnexos();
            expect(await armazenamento.ler(anexo.arquivo)).not.toBeNull();

            await new ExcluirProjeto(factory).execute(projeto.codigo);

            expect(await factory.criarProjetoRepository().buscarPorCodigo(projeto.codigo)).toBeNull();
            const { rows } = await pool.query("SELECT count(*)::int AS n FROM tarefas WHERE projeto_codigo = $1", [projeto.codigo]);
            expect(rows[0].n).toBe(0);
            expect(await repo.listarPorDonos(DonoAnexo.TAREFA, [tarefa.codigo])).toHaveLength(0);
            expect(await armazenamento.ler(anexo.arquivo)).toBeNull();
        } finally {
            delete process.env.ANEXOS_DIR;
            rmSync(pasta, { recursive: true, force: true });
        }
    });

    test("listarCodigosPorProjeto devolve só os códigos das tarefas do projeto", async () => {
        const inicio = new Date("2026-10-12T00:00:00.000Z");
        const fim = new Date("2026-10-30T00:00:00.000Z");
        const projetos = factory.criarProjetoRepository();
        const novoProjeto = () => projetos.criar(new Projeto("Projeto", "Descrição", inicio, fim, undefined, [], crypto.randomUUID()));
        const [projeto, outro] = [await novoProjeto(), await novoProjeto()];
        const tarefas = factory.criarTarefaRepository();
        const criar = (p: Projeto) =>
            tarefas.criar(new Tarefa(p, "T", inicio, fim, StatusTarefa.PENDENTE, PrioridadeTarefa.P2, "D", null, null, [], []));
        const [t1, t2] = [await criar(projeto), await criar(projeto)];
        await criar(outro);

        expect((await tarefas.listarCodigosPorProjeto(projeto.codigo)).sort()).toEqual([t1.codigo, t2.codigo].sort());
        expect(await tarefas.listarCodigosPorProjeto(crypto.randomUUID())).toEqual([]);
    });
});
