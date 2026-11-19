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
import ItemBiblioteca from "../../source/domain/entity/ItemBiblioteca";
import { DonoAnexo } from "../../source/domain/enum/Anexo";
import GerirAnexos from "../../source/useCases/anexos/GerirAnexos";
import SalvarArea from "../../source/useCases/config/SalvarArea";
import Tarefa from "../../source/domain/entity/Tarefa";
import ProjetoRepositoryDatabase from "../../source/infra/repository/database/ProjetoRepositoryDatabase";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

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

    describe("geral opcional (sessão 24b)", () => {
        let pasta: string;
        let diretor: Usuario;

        beforeAll(async () => {
            pasta = mkdtempSync(path.join(tmpdir(), "anexos-"));
            process.env.ANEXOS_DIR = pasta;
            diretor = new Usuario(
                "Dora",
                "dora@teste.com",
                PerfilUsuario.DIRETOR,
                true,
                "hash",
                new SenioridadeUsuario("pleno", "Pleno", 75),
            );
            await factory.criarUsuarioRepository().criar(diretor);
        });

        afterAll(() => {
            delete process.env.ANEXOS_DIR;
            rmSync(pasta, { recursive: true, force: true });
        });

        /** Área nova (com geral) e um item da equipe do geral com anexo no disco. */
        async function cenario(nome: string) {
            const area = await new SalvarArea(factory).execute({ nome });
            const geral = (await factory.criarProjetoRepository().buscarGeralDaArea(area.codigo))!;
            const item = await factory.criarBibliotecaRepository().criar(
                new ItemBiblioteca({
                    titulo: `Ata ${nome}`,
                    sigilo: "projeto",
                    projeto: { codigo: geral.codigo, nome: geral.nome },
                    autor: { codigo: diretor.codigo, nome: diretor.nome },
                }),
            );
            const anexo = await new GerirAnexos(factory).enviar(
                { codigo: diretor.codigo, perfil: diretor.perfil },
                DonoAnexo.BIBLIOTECA,
                item.codigo,
                { nome: "ata.pdf", conteudo: Buffer.from("%PDF-1.4") },
            );
            return { area, geral, item, arquivo: path.join(pasta, anexo.arquivo) };
        }

        const linhaArea = async (codigo: string) =>
            (await pool.query("SELECT nome, tem_geral FROM areas WHERE codigo = $1", [codigo])).rows[0];
        const existe = async (tabela: string, codigo: string) =>
            (await pool.query(`SELECT 1 FROM ${tabela} WHERE codigo = $1`, [codigo])).rowCount === 1;

        test("desligar sem tarefas exclui o geral, as colunas, o item da equipe e o arquivo; religar cria outro", async () => {
            const { area, geral, item, arquivo } = await cenario("Jurídico");
            expect(geral.nome).toBe("Jurídico geral");

            await new SalvarArea(factory).execute({ codigo: area.codigo, nome: "Jurídico", temGeral: false });

            expect(await linhaArea(area.codigo)).toEqual({ nome: "Jurídico", tem_geral: false });
            expect(await existe("projetos", geral.codigo)).toBe(false);
            expect((await pool.query("SELECT 1 FROM colunas_projeto WHERE projeto_codigo = $1", [geral.codigo])).rowCount).toBe(0);
            expect(await existe("biblioteca_itens", item.codigo)).toBe(false);
            expect(existsSync(arquivo)).toBe(false);
            expect((await factory.criarAreaRepository().buscarPorCodigo(area.codigo))?.temGeral).toBe(false);

            await new SalvarArea(factory).execute({ codigo: area.codigo, nome: "Jurídico" });
            expect(await factory.criarProjetoRepository().buscarGeralDaArea(area.codigo)).toBeNull();

            await new SalvarArea(factory).execute({ codigo: area.codigo, nome: "Jurídico", temGeral: true });
            const novo = (await factory.criarProjetoRepository().buscarGeralDaArea(area.codigo))!;
            expect(novo.codigo).not.toBe(geral.codigo);
            expect(await linhaArea(area.codigo)).toEqual({ nome: "Jurídico", tem_geral: true });
        });

        test("geral com tarefa: 409 GERAL_COM_TAREFAS e nada muda", async () => {
            const { area, geral, item, arquivo } = await cenario("Comercial");
            await pool.query(
                `INSERT INTO tarefas (titulo, projeto_codigo, coluna_codigo, status, data_inicio, data_fim)
                 SELECT 'T', $1, codigo, 'pendente', '2026-01-01', '2026-02-01' FROM colunas_projeto WHERE projeto_codigo = $1 AND papel = 'entrada'`,
                [geral.codigo],
            );

            await expect(new SalvarArea(factory).execute({ codigo: area.codigo, nome: "Vendas", temGeral: false })).rejects.toMatchObject({
                codigo: "GERAL_COM_TAREFAS",
                message: expect.stringContaining("1 tarefa"),
            });

            expect(await linhaArea(area.codigo)).toEqual({ nome: "Comercial", tem_geral: true });
            expect(await existe("projetos", geral.codigo)).toBe(true);
            expect(await existe("biblioteca_itens", item.codigo)).toBe(true);
            expect(existsSync(arquivo)).toBe(true);
        });

        test("criar tarefa num geral que acabou de ser excluído dá 404 do projeto, não 500", async () => {
            const { area, geral } = await cenario("Eventos");
            const entrada = geral.colunas.find((c) => c.papel === "entrada")!;
            const tarefa = new Tarefa(
                geral,
                "Atrasada",
                dia("2026-11-20"),
                dia("2026-11-27"),
                undefined,
                undefined,
                null,
                null,
                null,
                [],
                [],
                undefined,
                null,
                null,
                entrada,
            );
            await new SalvarArea(factory).execute({ codigo: area.codigo, nome: "Eventos", temGeral: false });

            await expect(factory.criarTarefaRepository().criar(tarefa)).rejects.toMatchObject({ codigoHttp: 404 });
        });

        test("se a exclusão do geral falhar, a área continua com o geral e o arquivo continua no disco", async () => {
            const { area, geral, item, arquivo } = await cenario("Marketing");
            const falha = jest.spyOn(ProjetoRepositoryDatabase.prototype, "excluir").mockRejectedValue(new Error("falha no banco"));
            try {
                await expect(new SalvarArea(factory).execute({ codigo: area.codigo, nome: "Marketing", temGeral: false })).rejects.toThrow(
                    "falha no banco",
                );
            } finally {
                falha.mockRestore();
            }

            expect(await linhaArea(area.codigo)).toEqual({ nome: "Marketing", tem_geral: true });
            expect(await existe("projetos", geral.codigo)).toBe(true);
            expect(await existe("biblioteca_itens", item.codigo)).toBe(true);
            expect((await pool.query("SELECT 1 FROM anexos WHERE dono_codigo = $1", [item.codigo])).rowCount).toBe(1);
            expect(existsSync(arquivo)).toBe(true);
        });
    });
});
