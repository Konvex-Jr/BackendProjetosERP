import { mkdtempSync, rmSync, existsSync, readdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import ArmazenamentoFotosDisco from "../source/infra/arquivos/ArmazenamentoFotosDisco";

const NOME = "3f0c1b6e-2d4a-4b8e-9c1d-5a6b7c8d9e0f.webp";

describe("armazenamento de fotos em disco", () => {
    let pasta: string;
    beforeEach(() => {
        pasta = path.join(mkdtempSync(path.join(tmpdir(), "fotos-")), "fotos");
    });
    afterEach(() => rmSync(path.dirname(pasta), { recursive: true, force: true }));

    it("salva, abre e exclui", async () => {
        const arm = new ArmazenamentoFotosDisco(pasta);
        await arm.salvar(NOME, Buffer.from("abc"));
        const aberto = await arm.abrir(NOME);
        expect(aberto!.tamanho).toBe(3);
        const partes: Buffer[] = [];
        for await (const p of aberto!.fluxo) partes.push(Buffer.from(p as Buffer));
        expect(Buffer.concat(partes).toString()).toBe("abc");
        await arm.excluir(NOME);
        expect(await arm.abrir(NOME)).toBeNull();
        await expect(arm.excluir(NOME)).resolves.toBeUndefined();
    });

    it("não sobrescreve foto existente", async () => {
        const arm = new ArmazenamentoFotosDisco(pasta);
        await arm.salvar(NOME, Buffer.from("a"));
        await expect(arm.salvar(NOME, Buffer.from("b"))).rejects.toMatchObject({ code: "EEXIST" });
    });

    it("abrir com nome inválido devolve null sem tocar no disco", async () => {
        const arm = new ArmazenamentoFotosDisco(pasta);
        expect(await arm.abrir("../x")).toBeNull();
        expect(await arm.abrir("abc.png")).toBeNull();
        expect(existsSync(pasta)).toBe(false);
    });

    it("salvar e excluir com nome inválido lançam sem criar nada", async () => {
        const arm = new ArmazenamentoFotosDisco(pasta);
        await expect(arm.salvar("../x.webp", Buffer.from("a"))).rejects.toMatchObject({ codigo: "FOTO_NOME_INVALIDO" });
        await expect(arm.excluir("abc.png")).rejects.toMatchObject({ codigo: "FOTO_NOME_INVALIDO" });
        expect(existsSync(pasta)).toBe(false);
        expect(readdirSync(path.dirname(pasta))).toEqual([]);
    });
});
