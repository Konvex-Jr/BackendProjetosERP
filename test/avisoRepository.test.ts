import AvisoRepositoryMemory from "../source/infra/repository/memory/AvisoRepositoryMemory";
import { NovoAviso } from "../source/domain/interfaces/AvisoRepositoryInterface";

const tarefa = (usuario: string, t: string): NovoAviso => ({
    codigoUsuario: usuario,
    tipo: "tarefa_recebida",
    codigoTarefa: t,
    codigoCapacitacao: null,
    codigoAutor: null,
});

describe("AvisoRepositoryMemory", () => {
    test("duplicata não lida de tarefa_recebida grava um só", async () => {
        const repo = new AvisoRepositoryMemory();
        await repo.criarVarios([tarefa("a", "t1"), tarefa("a", "t1")]);
        await repo.criarVarios([tarefa("a", "t1")]);
        expect(await repo.listarDoUsuario("a")).toHaveLength(1);
    });

    test("com o anterior lido grava outro", async () => {
        const repo = new AvisoRepositoryMemory();
        await repo.criarVarios([tarefa("a", "t1")]);
        await repo.marcarLidos("a");
        await repo.criarVarios([tarefa("a", "t1")]);
        expect(await repo.listarDoUsuario("a")).toHaveLength(2);
    });

    test("listarDoUsuario em ordem decrescente de criadoEm", async () => {
        const repo = new AvisoRepositoryMemory();
        await repo.criarVarios([tarefa("a", "t1"), tarefa("a", "t2"), tarefa("a", "t3")]);
        const lista = await repo.listarDoUsuario("a");
        expect(lista.map((x) => x.codigoTarefa)).toEqual(["t3", "t2", "t1"]);
    });

    test("marcarLidos ignora código de outra pessoa; sem códigos marca todos", async () => {
        const repo = new AvisoRepositoryMemory();
        await repo.criarVarios([tarefa("a", "t1"), tarefa("a", "t2"), tarefa("b", "t1")]);
        const [deB] = await repo.listarDoUsuario("b");
        await repo.marcarLidos("a", [deB.codigo]);
        expect((await repo.listarDoUsuario("b"))[0].lidoEm).toBeNull();
        expect((await repo.listarDoUsuario("a")).every((x) => x.lidoEm === null)).toBe(true);
        await repo.marcarLidos("a");
        expect((await repo.listarDoUsuario("a")).every((x) => x.lidoEm !== null)).toBe(true);
        expect((await repo.listarDoUsuario("b"))[0].lidoEm).toBeNull();
    });

    test("apagarLidosAntes apaga só lidos antes do limite", async () => {
        const repo = new AvisoRepositoryMemory();
        await repo.criarVarios([tarefa("a", "t1"), tarefa("a", "t2")]);
        const [recente] = await repo.listarDoUsuario("a");
        await repo.marcarLidos("a", [recente.codigo]);
        await repo.apagarLidosAntes("a", new Date(Date.now() - 60000));
        expect(await repo.listarDoUsuario("a")).toHaveLength(2);
        await repo.apagarLidosAntes("a", new Date(Date.now() + 60000));
        const resto = await repo.listarDoUsuario("a");
        expect(resto).toHaveLength(1);
        expect(resto[0].lidoEm).toBeNull();
    });
});
