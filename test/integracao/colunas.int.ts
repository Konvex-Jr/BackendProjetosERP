/**
 * Integração do quadro de colunas contra PostgreSQL de verdade (sessão 21).
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
import ColunaProjeto from "../../source/domain/entity/ColunaProjeto";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import StatusTarefa from "../../source/domain/enum/StatusTarefa";
import GerirColunasProjeto, { EntradaColuna } from "../../source/useCases/projetos/GerirColunasProjeto";
import ExcluirProjeto from "../../source/useCases/projetos/ExcluirProjeto";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const inicio = new Date("2026-10-12T00:00:00.000Z");
const fim = new Date("2026-10-30T00:00:00.000Z");
const HOJE = new Date("2026-11-16T00:00:00.000Z");

descrever("colunas do quadro contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let factory: DatabaseRepositoryFactory;
    let pessoa: Usuario;

    const entrada = (c: ColunaProjeto): EntradaColuna => ({ codigo: c.codigo, nome: c.nome, cor: c.cor, papel: c.papel });

    async function novoProjeto(): Promise<Projeto> {
        return factory
            .criarProjetoRepository()
            .criar(new Projeto("Projeto", "Descrição", inicio, fim, undefined, [pessoa], crypto.randomUUID()));
    }
    async function novaTarefa(projeto: Projeto, coluna: ColunaProjeto): Promise<Tarefa> {
        // Nasce na entrada e vai para a coluna pelo domínio, que registra data e autor se for a concluída.
        const base = new Tarefa(
            projeto,
            "Tarefa",
            inicio,
            fim,
            StatusTarefa.PENDENTE,
            undefined,
            null,
            null,
            null,
            [pessoa],
            [],
            undefined,
            null,
            null,
            null,
            projeto.colunaDeEntrada,
        );
        return factory.criarTarefaRepository().criar(base.naColuna(coluna, inicio, pessoa));
    }
    const gravar = (projeto: Projeto, colunas: EntradaColuna[], destinos?: Record<string, string>) =>
        new GerirColunasProjeto(factory).execute({ codigoProjeto: projeto.codigo, colunas, destinos, hoje: HOJE, quem: pessoa });
    const lerProjeto = async (projeto: Projeto) => (await factory.criarProjetoRepository().buscarPorCodigo(projeto.codigo))!;

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        conexao = PgConexao.criar(URL_TESTE!);
        factory = new DatabaseRepositoryFactory(conexao);
        pessoa = new Usuario(
            "Pessoa",
            "pessoa@teste.com",
            PerfilUsuario.MEMBRO,
            true,
            "hash",
            new SenioridadeUsuario("pleno", "Pleno", 75),
        );
        await factory.criarUsuarioRepository().criar(pessoa);
    }, 60000);

    afterAll(async () => {
        await conexao?.encerrar();
        await pool?.end();
    });

    test("um PUT troca os nomes de duas colunas e a entrada com a concluída", async () => {
        const projeto = await novoProjeto();
        const [a, f, r, c] = projeto.colunas;
        // Nomes A<->B (Fazendo <-> Revisando), papéis entrada<->concluida, tudo numa gravação só.
        const gravadas = await gravar(projeto, [
            { ...entrada(a), papel: "concluida" },
            { ...entrada(f), nome: r.nome },
            { ...entrada(r), nome: f.nome },
            { ...entrada(c), papel: "entrada" },
        ]);
        expect(gravadas.map((x) => [x.nome, x.papel])).toEqual([
            ["A fazer", "concluida"],
            ["Revisando", "meio"],
            ["Fazendo", "meio"],
            ["Concluído", "entrada"],
        ]);
        const lido = await lerProjeto(projeto);
        expect(lido.colunas.map((x) => [x.codigo, x.nome, x.papel])).toEqual(gravadas.map((x) => [x.codigo, x.nome, x.papel]));
    });

    test("trocar a coluna concluída deixa status e coluna coerentes em todas as tarefas", async () => {
        const projeto = await novoProjeto();
        const [, f, r, c] = projeto.colunas;
        await novaTarefa(projeto, c);
        await novaTarefa(projeto, r);
        await novaTarefa(projeto, f);
        await gravar(
            projeto,
            projeto.colunas.map((x) => ({
                ...entrada(x),
                papel: x.nome === "Concluído" ? "meio" : x.nome === "Revisando" ? "concluida" : x.papel,
            })),
        );
        const incoerentes = await pool.query(
            `SELECT count(*)::int AS n FROM tarefas t JOIN colunas_projeto c ON c.codigo = t.coluna_codigo
             WHERE (t.status = 'concluida') <> (c.papel = 'concluida')`,
        );
        expect(incoerentes.rows[0].n).toBe(0);
        const tarefas = await factory.criarTarefaRepository().listarPorProjeto(projeto.codigo);
        const concluidas = tarefas.filter((t) => t.status === StatusTarefa.CONCLUIDA);
        expect(concluidas).toHaveLength(1);
        expect(concluidas[0].coluna!.nome).toBe("Revisando");
        expect(concluidas[0].dataConclusao).toEqual(HOJE);
    });

    test("excluir coluna com tarefa move para o destino; coluna nova entra na ordem", async () => {
        const projeto = await novoProjeto();
        const [a, f, r, c] = projeto.colunas;
        const tarefa = await novaTarefa(projeto, r);
        const gravadas = await gravar(projeto, [entrada(a), { nome: "Testando", cor: "roxo", papel: "meio" }, entrada(f), entrada(c)], {
            [r.codigo]: f.codigo,
        });
        expect(gravadas.map((x) => x.nome)).toEqual(["A fazer", "Testando", "Fazendo", "Concluído"]);
        const lida = (await factory.criarTarefaRepository().buscarPorCodigo(tarefa.codigo))!;
        expect(lida.coluna!.codigo).toBe(f.codigo);
        expect((await lerProjeto(projeto)).colunas.map((x) => x.nome)).toEqual(["A fazer", "Testando", "Fazendo", "Concluído"]);
    });

    test("tarefa que cai na coluna excluída no meio do caminho: 409 QUADRO_MUDOU e nada muda", async () => {
        const projeto = await novoProjeto();
        const [a, f, r, c] = projeto.colunas;
        // Simula a corrida: o caso de uso viu a coluna vazia, mas uma tarefa entrou nela antes da gravação.
        await pool.query(
            `INSERT INTO tarefas (codigo, projeto_codigo, coluna_codigo, titulo, data_inicio, data_fim, status)
             VALUES (gen_random_uuid(), $1, $2, 'Nova', '2026-10-12', '2026-10-30', 'andamento')`,
            [projeto.codigo, r.codigo],
        );
        await expect(
            factory.criarColunaProjetoRepository().substituir(projeto.codigo, [a, { ...f, nome: "Renomeada" } as ColunaProjeto, c], []),
        ).rejects.toMatchObject({ codigo: "QUADRO_MUDOU" });
        const lido = await lerProjeto(projeto);
        expect(lido.colunas.map((x) => x.nome)).toEqual(["A fazer", "Fazendo", "Revisando", "Concluído"]);
    });

    test("excluir o projeto depois de personalizar as colunas funciona", async () => {
        const projeto = await novoProjeto();
        const [a, f, , c] = projeto.colunas;
        const tarefa = await novaTarefa(projeto, f);
        await gravar(projeto, [
            { ...entrada(c), papel: "concluida" },
            { nome: "Nova", cor: "rosa", papel: "meio" },
            entrada(f),
            entrada(a),
        ]);
        await new ExcluirProjeto(factory).execute(projeto.codigo);
        expect(await factory.criarProjetoRepository().buscarPorCodigo(projeto.codigo)).toBeNull();
        expect((await pool.query("SELECT 1 FROM colunas_projeto WHERE projeto_codigo = $1", [projeto.codigo])).rowCount).toBe(0);
        expect(await factory.criarTarefaRepository().buscarPorCodigo(tarefa.codigo)).toBeNull();
    });
});
