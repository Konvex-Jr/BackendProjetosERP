import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import { RegistroLinkSenha } from "../source/domain/interfaces/LinkSenhaRepositoryInterface";

function registro(extra: Partial<RegistroLinkSenha> = {}): RegistroLinkSenha {
    return {
        codigo: "l1",
        codigoUsuario: "u1",
        tipo: "convite",
        tokenHash: "h1",
        expiraEm: new Date(Date.now() + 1000),
        usadoEm: null,
        ...extra,
    };
}

describe("LinkSenhaRepository (memória)", () => {
    const novo = () => new MemoryRepositoryFactory().criarLinkSenhaRepository();

    test("marcarUsado devolve true na primeira vez e false na segunda", async () => {
        const repo = novo();
        await repo.criar(registro());
        expect(await repo.marcarUsado("l1")).toBe(true);
        expect(await repo.marcarUsado("l1")).toBe(false);
        expect(await repo.marcarUsado("nao-existe")).toBe(false);
    });

    test("busca por hash e invalida só os abertos do tipo pedido", async () => {
        const repo = novo();
        await repo.criar(registro());
        await repo.criar(registro({ codigo: "l2", tipo: "redefinir", tokenHash: "h2" }));
        expect((await repo.buscarPorHash("h1"))?.codigo).toBe("l1");
        expect(await repo.buscarPorHash("x")).toBeNull();
        await repo.invalidarDoUsuario("u1", "convite");
        expect((await repo.buscarPorHash("h1"))?.usadoEm).not.toBeNull();
        expect((await repo.buscarPorHash("h2"))?.usadoEm).toBeNull();
        await repo.invalidarDoUsuario("u1");
        expect((await repo.buscarPorHash("h2"))?.usadoEm).not.toBeNull();
    });
});
