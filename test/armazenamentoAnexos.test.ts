import { promises as fs } from "fs";
import os from "os";
import path from "path";
import ArmazenamentoAnexosDisco from "../source/infra/arquivos/ArmazenamentoAnexosDisco";
import ArmazenamentoAnexosMemoria from "../source/infra/arquivos/ArmazenamentoAnexosMemoria";

const UUID = "11111111-2222-3333-4444-555555555555";

async function lerTudo(fluxo: NodeJS.ReadableStream): Promise<Buffer> {
    const partes: Buffer[] = [];
    for await (const parte of fluxo) partes.push(Buffer.from(parte as Buffer));
    return Buffer.concat(partes);
}

describe("abrir (download em fluxo)", () => {
    let pasta: string;
    beforeEach(async () => {
        pasta = await fs.mkdtemp(path.join(os.tmpdir(), "anexos-"));
    });
    afterEach(async () => fs.rm(pasta, { recursive: true, force: true }));

    it("disco: devolve fluxo e tamanho; arquivo ausente devolve null", async () => {
        const disco = new ArmazenamentoAnexosDisco(pasta);
        await disco.salvar(UUID, Buffer.from("conteúdo"));
        const aberto = await disco.abrir(UUID);
        expect(aberto?.tamanho).toBe(Buffer.byteLength("conteúdo"));
        expect((await lerTudo(aberto!.fluxo)).toString()).toBe("conteúdo");
        expect(await disco.abrir("99999999-2222-3333-4444-555555555555")).toBeNull();
    });

    it("memória: devolve fluxo e tamanho; arquivo ausente devolve null", async () => {
        const memoria = new ArmazenamentoAnexosMemoria();
        await memoria.salvar("a", Buffer.from("abc"));
        const aberto = await memoria.abrir("a");
        expect(aberto?.tamanho).toBe(3);
        expect((await lerTudo(aberto!.fluxo)).toString()).toBe("abc");
        expect(await memoria.abrir("b")).toBeNull();
    });
});
