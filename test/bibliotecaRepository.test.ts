import ItemBiblioteca from "../source/domain/entity/ItemBiblioteca";
import BibliotecaRepositoryMemory from "../source/infra/repository/memory/BibliotecaRepositoryMemory";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";

const P1 = { codigo: "p1", nome: "Projeto 1" };
const P2 = { codigo: "p2", nome: "Projeto 2" };
const A1 = { codigo: "a1", nome: "Ana" };
const A2 = { codigo: "a2", nome: "Beto" };
const dia = (d: number) => new Date(`2026-11-${String(d).padStart(2, "0")}T12:00:00Z`);

describe("BibliotecaRepositoryMemory", () => {
    let repo: BibliotecaRepositoryMemory;
    beforeEach(() => {
        repo = new BibliotecaRepositoryMemory();
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
        expect((await repo.listar({ busca: "IFOOD" })).map((i) => i.titulo).sort()).toEqual(["a", "b"]);
    });

    test("busca procura no título", async () => {
        await repo.criar(new ItemBiblioteca({ titulo: "Contrato Social" }));
        expect(await repo.listar({ busca: "contrato" })).toHaveLength(1);
    });

    test("filtros tag, codigoProjeto, sigilo e codigoAutor combinam", async () => {
        await repo.criar(new ItemBiblioteca({ titulo: "1", tags: ["x"], projeto: P1, sigilo: "projeto", autor: A1 }));
        await repo.criar(new ItemBiblioteca({ titulo: "2", tags: ["x"], projeto: P1, autor: A2 }));
        await repo.criar(new ItemBiblioteca({ titulo: "3", tags: ["y"], projeto: P2, autor: A1 }));
        const t = async (f: object) => (await repo.listar(f)).map((i) => i.titulo).sort();
        expect(await t({ tag: "X" })).toEqual(["1", "2"]);
        expect(await t({ codigoProjeto: "p1" })).toEqual(["1", "2"]);
        expect(await t({ sigilo: "projeto" })).toEqual(["1"]);
        expect(await t({ codigoAutor: "a1" })).toEqual(["1", "3"]);
        expect(await t({ tag: "x", codigoProjeto: "p1", codigoAutor: "a2" })).toEqual(["2"]);
    });

    test("buscarPorCodigo, editar e excluir", async () => {
        const i = await repo.criar(new ItemBiblioteca({ titulo: "a" }));
        expect((await repo.buscarPorCodigo(i.codigo))?.titulo).toBe("a");
        expect(await repo.buscarPorCodigo("nada")).toBeNull();
        await repo.editar(new ItemBiblioteca({ codigo: i.codigo, titulo: "b" }));
        expect((await repo.buscarPorCodigo(i.codigo))?.titulo).toBe("b");
        await repo.excluir(i.codigo);
        expect(await repo.listar()).toHaveLength(0);
    });

    test("desligarProjeto zera projeto de todos/gestao e mantém o de sigilo projeto", async () => {
        const t = await repo.criar(new ItemBiblioteca({ titulo: "t", projeto: P1, sigilo: "todos" }));
        const g = await repo.criar(new ItemBiblioteca({ titulo: "g", projeto: P1, sigilo: "gestao" }));
        const s = await repo.criar(new ItemBiblioteca({ titulo: "s", projeto: P1, sigilo: "projeto" }));
        const o = await repo.criar(new ItemBiblioteca({ titulo: "o", projeto: P2, sigilo: "todos" }));
        await repo.desligarProjeto("p1");
        expect((await repo.buscarPorCodigo(t.codigo))?.projeto).toBeNull();
        expect((await repo.buscarPorCodigo(g.codigo))?.projeto).toBeNull();
        expect((await repo.buscarPorCodigo(s.codigo))?.projeto?.codigo).toBe("p1");
        expect((await repo.buscarPorCodigo(o.codigo))?.projeto?.codigo).toBe("p2");
    });

    test("factory em memória devolve sempre o mesmo repositório", () => {
        const f = new MemoryRepositoryFactory();
        expect(f.criarBibliotecaRepository()).toBe(f.criarBibliotecaRepository());
    });
});
