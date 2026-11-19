/**
 * Projeto geral da área contra PostgreSQL de verdade (sessão 23b): a equipe e a liderança vêm dos
 * períodos da área, calculadas ao ler; nada disso é gravado em projeto_membros.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import Usuario from "../../source/domain/entity/Usuario";
import SenioridadeUsuario from "../../source/domain/entity/SenioridadeUsuario";
import Area from "../../source/domain/entity/Area";
import Cargo from "../../source/domain/entity/Cargo";
import PeriodoArea from "../../source/domain/entity/PeriodoArea";
import Projeto from "../../source/domain/entity/Projeto";
import { novoGeral } from "../../source/domain/entity/ProjetoGeral";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import TipoProjeto from "../../source/domain/enum/TipoProjeto";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

descrever("projeto geral da área contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let factory: DatabaseRepositoryFactory;
    let inovacao: Area;
    let ana: Usuario;
    let bia: Usuario;
    let caio: Usuario;
    let duda: Usuario;
    let geral: Projeto;
    let interno: Projeto;
    let cliente: Projeto;

    async function novaPessoa(nome: string): Promise<Usuario> {
        const pessoa = new Usuario(
            nome,
            `${nome.toLowerCase()}@teste.com`,
            PerfilUsuario.MEMBRO,
            true,
            "hash",
            new SenioridadeUsuario("pleno", "Pleno", 75),
        );
        await factory.criarUsuarioRepository().criar(pessoa);
        return pessoa;
    }

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        conexao = PgConexao.criar(URL_TESTE!);
        factory = new DatabaseRepositoryFactory(conexao);
        const areas = factory.criarAreaRepository();
        const projetosArea = await areas.criar(new Area("Projetos"));
        inovacao = await areas.criar(new Area("Inovação", projetosArea.codigo));
        const gerente = await factory.criarCargoRepository().criar(new Cargo("Gerente", true, undefined, true));

        ana = await novaPessoa("Ana");
        bia = await novaPessoa("Bia");
        caio = await novaPessoa("Caio");
        duda = await novaPessoa("Duda");
        const periodos = factory.criarPeriodoAreaRepository();
        await periodos.criar(new PeriodoArea(ana.codigo, inovacao, null, dia("2026-01-10"), null, null));
        await periodos.criar(new PeriodoArea(bia.codigo, inovacao, null, dia("2025-01-10"), dia("2026-01-10"), null));
        await periodos.criar(new PeriodoArea(caio.codigo, projetosArea, gerente, dia("2026-01-10"), null, null));

        const repo = factory.criarProjetoRepository();
        geral = await repo.criar(novoGeral(inovacao, dia("2026-11-19")));
        interno = await repo.criar(
            new Projeto("Interno", "Descrição", dia("2026-11-01"), dia("2026-12-01"), undefined, [duda], undefined, {
                area: inovacao,
                tipo: TipoProjeto.INTERNO,
            }),
        );
        cliente = await repo.criar(new Projeto("Cliente", "Descrição", dia("2026-11-01"), dia("2026-12-01"), undefined, [duda]));
    }, 60000);

    afterAll(async () => {
        await conexao?.encerrar();
        await pool?.end();
    });

    test("tipo e geral_da_area são gravados e lidos", async () => {
        const repo = factory.criarProjetoRepository();
        const lido = (await repo.buscarPorCodigo(geral.codigo))!;
        expect(lido.tipo).toBe(TipoProjeto.INTERNO);
        expect(lido.geralDaArea).toBe(true);
        expect((await repo.buscarPorCodigo(interno.codigo))!.tipo).toBe(TipoProjeto.INTERNO);
        expect((await repo.buscarPorCodigo(interno.codigo))!.geralDaArea).toBe(false);
        expect((await repo.buscarPorCodigo(cliente.codigo))!.tipo).toBe(TipoProjeto.CLIENTE);
    });

    test("a equipe do geral vem dos períodos da área; a liderança, dos cargos que lideram", async () => {
        const lido = (await factory.criarProjetoRepository().buscarPorCodigo(geral.codigo))!;
        expect(lido.membros.map((m) => m.codigo)).toEqual([ana.codigo]);
        const saida = lido.participacoes.find((p) => p.usuario.codigo === bia.codigo);
        expect(saida?.dataSaida).toEqual(dia("2026-01-10"));
        expect(lido.lideresDaArea).toEqual([caio.codigo]);
        expect(lido.lider).toBeNull();
        expect(lido.ehLider(caio.codigo)).toBe(true);
    });

    test("buscarGeralDaArea devolve o geral com a equipe", async () => {
        const repo = factory.criarProjetoRepository();
        const achado = (await repo.buscarGeralDaArea(inovacao.codigo))!;
        expect(achado.codigo).toBe(geral.codigo);
        expect(achado.membros.map((m) => m.codigo)).toEqual([ana.codigo]);
        expect(await repo.buscarGeralDaArea(crypto.randomUUID())).toBeNull();
    });

    test("listarPorMembro traz o geral a quem tem ou teve período na área, ou a lidera", async () => {
        const repo = factory.criarProjetoRepository();
        const codigos = async (u: Usuario) => (await repo.listarPorMembro(u.codigo)).map((p) => p.codigo);
        expect(await codigos(ana)).toContain(geral.codigo);
        expect(await codigos(bia)).toContain(geral.codigo);
        expect(await codigos(caio)).toContain(geral.codigo);
        const daDuda = await codigos(duda);
        expect(daDuda).not.toContain(geral.codigo);
        expect(daDuda).toEqual(expect.arrayContaining([interno.codigo, cliente.codigo]));
    });

    test("editar o geral não grava participação nem líder", async () => {
        const repo = factory.criarProjetoRepository();
        const lido = (await repo.buscarPorCodigo(geral.codigo))!;
        await repo.editar(lido.comColunas(lido.colunas));
        await repo.editar(lido.copiar({ lider: ana }));
        const membros = await pool.query("SELECT 1 FROM projeto_membros WHERE projeto_codigo = $1", [geral.codigo]);
        expect(membros.rowCount).toBe(0);
        const linha = await pool.query("SELECT lider_codigo, tipo, geral_da_area FROM projetos WHERE codigo = $1", [geral.codigo]);
        expect(linha.rows[0]).toEqual({ lider_codigo: null, tipo: "interno", geral_da_area: true });
    });

    test("listar filtra por tipo", async () => {
        const repo = factory.criarProjetoRepository();
        const internos = (await repo.listar({ tipo: TipoProjeto.INTERNO })).map((p) => p.codigo);
        expect(internos.sort()).toEqual([geral.codigo, interno.codigo].sort());
        expect((await repo.listar({ tipo: TipoProjeto.CLIENTE })).map((p) => p.codigo)).toEqual([cliente.codigo]);
    });
});
