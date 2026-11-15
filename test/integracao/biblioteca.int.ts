/**
 * Integração da Biblioteca (repositório e tabela) contra PostgreSQL de verdade.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado.
 */
import { Pool } from "pg";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import ItemBiblioteca from "../../source/domain/entity/ItemBiblioteca";
import BibliotecaRepositoryInterface from "../../source/domain/interfaces/BibliotecaRepositoryInterface";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;

descrever("biblioteca contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let repo: BibliotecaRepositoryInterface;
    let p1: { codigo: string; nome: string };
    let p2: { codigo: string; nome: string };
    let ana: { codigo: string; nome: string };
    let beto: { codigo: string; nome: string };
    const dia = (d: number) => new Date(`2026-11-${String(d).padStart(2, "0")}T12:00:00Z`);

    async function inserir(sql: string, nome: string, extra: unknown[] = []) {
        const { rows } = await pool.query(sql, [nome, ...extra]);
        return { codigo: rows[0].codigo as string, nome };
    }

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        await aplicarMigracoes(pool);
        const proj =
            "INSERT INTO projetos (nome, descricao, data_inicio, data_fim) VALUES ($1, '', '2026-11-01', '2026-12-01') RETURNING codigo";
        const usu = "INSERT INTO usuarios (nome, email) VALUES ($1, $2) RETURNING codigo";
        p1 = await inserir(proj, "Projeto 1");
        p2 = await inserir(proj, "Projeto 2");
        ana = await inserir(usu, "Ana", ["ana@teste.com"]);
        beto = await inserir(usu, "Beto", ["beto@teste.com"]);
        conexao = PgConexao.criar(URL_TESTE!);
        repo = new DatabaseRepositoryFactory(conexao).criarBibliotecaRepository();
    }, 60000);

    afterEach(async () => {
        await pool.query("DELETE FROM biblioteca_itens");
    });

    afterAll(async () => {
        await conexao?.encerrar();
        await pool?.end();
    });

    test("cria e lê devolvendo projeto e autor como referência", async () => {
        const criado = await repo.criar(
            new ItemBiblioteca({ titulo: "Ata", conteudo: "texto", links: ["https://a.com"], tags: ["#X"], projeto: p1, autor: ana }),
        );
        expect(criado.projeto).toEqual(p1);
        expect(criado.autor).toEqual(ana);
        expect(criado.tags).toEqual(["x"]);
        expect(criado.sigilo).toBe("todos");
        const lido = await repo.buscarPorCodigo(criado.codigo);
        expect(lido?.links).toEqual(["https://a.com"]);
        expect(await repo.buscarPorCodigo("00000000-0000-0000-0000-000000000000")).toBeNull();
    });

    test("lista do mais recente para o mais antigo", async () => {
        const velho = await repo.criar(new ItemBiblioteca({ titulo: "velho", atualizadoEm: dia(1) }));
        const novo = await repo.criar(new ItemBiblioteca({ titulo: "novo", atualizadoEm: dia(3) }));
        const meio = await repo.criar(new ItemBiblioteca({ titulo: "meio", atualizadoEm: dia(2) }));
        expect((await repo.listar()).map((i) => i.codigo)).toEqual([novo.codigo, meio.codigo, velho.codigo]);
    });

    test("busca 'IFOOD' acha item com 'iFood' no conteúdo e item com tag 'ifood'", async () => {
        await repo.criar(new ItemBiblioteca({ titulo: "a", conteudo: "Reunião com o iFood" }));
        await repo.criar(new ItemBiblioteca({ titulo: "b", tags: ["#iFood"] }));
        await repo.criar(new ItemBiblioteca({ titulo: "c", conteudo: "outro assunto" }));
        await repo.criar(new ItemBiblioteca({ titulo: "Contrato 100%" }));
        expect((await repo.listar({ busca: "IFOOD" })).map((i) => i.titulo).sort()).toEqual(["a", "b"]);
        expect((await repo.listar({ busca: "contrato" })).map((i) => i.titulo)).toEqual(["Contrato 100%"]);
        expect(await repo.listar({ busca: "%" })).toHaveLength(1);
    });

    test("filtros tag, codigoProjeto, sigilo e codigoAutor combinam", async () => {
        await repo.criar(new ItemBiblioteca({ titulo: "1", tags: ["x"], projeto: p1, sigilo: "projeto", autor: ana }));
        await repo.criar(new ItemBiblioteca({ titulo: "2", tags: ["x"], projeto: p1, autor: beto }));
        await repo.criar(new ItemBiblioteca({ titulo: "3", tags: ["y"], projeto: p2, autor: ana }));
        const t = async (f: object) => (await repo.listar(f)).map((i) => i.titulo).sort();
        expect(await t({ tag: "X" })).toEqual(["1", "2"]);
        expect(await t({ codigoProjeto: p1.codigo })).toEqual(["1", "2"]);
        expect(await t({ sigilo: "projeto" })).toEqual(["1"]);
        expect(await t({ codigoAutor: ana.codigo })).toEqual(["1", "3"]);
        expect(await t({ tag: "x", codigoProjeto: p1.codigo, codigoAutor: beto.codigo })).toEqual(["2"]);
    });

    test("edita e exclui", async () => {
        const i = await repo.criar(new ItemBiblioteca({ titulo: "a", autor: ana }));
        const editado = await repo.editar(new ItemBiblioteca({ ...i, titulo: "b", sigilo: "gestao", atualizadoEm: dia(9) }));
        expect(editado.titulo).toBe("b");
        expect(editado.sigilo).toBe("gestao");
        expect(editado.autor).toEqual(ana);
        await expect(repo.editar(new ItemBiblioteca({ titulo: "z" }))).rejects.toThrow();
        await repo.excluir(i.codigo);
        expect(await repo.listar()).toHaveLength(0);
    });

    test("desligarProjeto zera projeto de todos/gestao e mantém o de sigilo projeto", async () => {
        const t = await repo.criar(new ItemBiblioteca({ titulo: "t", projeto: p1, sigilo: "todos" }));
        const g = await repo.criar(new ItemBiblioteca({ titulo: "g", projeto: p1, sigilo: "gestao" }));
        const s = await repo.criar(new ItemBiblioteca({ titulo: "s", projeto: p1, sigilo: "projeto" }));
        const o = await repo.criar(new ItemBiblioteca({ titulo: "o", projeto: p2, sigilo: "todos" }));
        await repo.desligarProjeto(p1.codigo);
        expect((await repo.buscarPorCodigo(t.codigo))?.projeto).toBeNull();
        expect((await repo.buscarPorCodigo(g.codigo))?.projeto).toBeNull();
        expect((await repo.buscarPorCodigo(s.codigo))?.projeto).toEqual(p1);
        expect((await repo.buscarPorCodigo(o.codigo))?.projeto).toEqual(p2);
    });

    test("o banco recusa sigilo projeto sem projeto e sigilo desconhecido", async () => {
        await expect(pool.query("INSERT INTO biblioteca_itens (titulo, sigilo) VALUES ('x', 'projeto')")).rejects.toThrow(
            /biblioteca_itens_sigilo_projeto/,
        );
        await expect(pool.query("INSERT INTO biblioteca_itens (titulo, sigilo) VALUES ('x', 'outro')")).rejects.toThrow(
            /biblioteca_itens_sigilo/,
        );
    });

    test("excluir o projeto solta os itens (SET NULL)", async () => {
        const proj = await inserir(
            "INSERT INTO projetos (nome, descricao, data_inicio, data_fim) VALUES ($1, '', '2026-11-01', '2026-12-01') RETURNING codigo",
            "Efêmero",
        );
        const i = await repo.criar(new ItemBiblioteca({ titulo: "i", projeto: proj }));
        await pool.query("DELETE FROM projetos WHERE codigo = $1", [proj.codigo]);
        expect((await repo.buscarPorCodigo(i.codigo))?.projeto).toBeNull();
    });

    test("anexos aceitam o dono biblioteca e recusam os donos antigos (CHECK da 012)", async () => {
        const item = await repo.criar(new ItemBiblioteca({ titulo: "com anexo" }));
        const anexo = (tipo: string) =>
            pool.query(
                `INSERT INTO anexos (codigo, dono_tipo, dono_codigo, nome, tipo_mime, tamanho_bytes, arquivo)
                 VALUES (gen_random_uuid(), $1, $2, 'a.pdf', 'application/pdf', 10, gen_random_uuid()::text)`,
                [tipo, item.codigo],
            );
        await expect(anexo("biblioteca")).resolves.toBeDefined();
        await expect(anexo("capacitacao")).resolves.toBeDefined();
        for (const antigo of ["documento", "conhecimento", "iniciativa"]) {
            await expect(anexo(antigo)).rejects.toThrow(/anexos_dono_valido/);
        }
        await pool.query("DELETE FROM anexos");
    });
});
