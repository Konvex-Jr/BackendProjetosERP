import StatusPessoa from "../source/domain/enum/StatusPessoa";
import GerirFotoPerfil from "../source/useCases/pessoas/GerirFotoPerfil";
import { NOME_FOTO } from "../source/shared/foto";
import AlterarStatusPessoa from "../source/useCases/pessoas/AlterarStatusPessoa";
import { criarContexto } from "./fixtures";

const webp = (extra = 10) => Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBP"), Buffer.alloc(extra, 7)]);

describe("foto de perfil (sessão 22)", () => {
    it("trocar grava o arquivo e a foto do usuário", async () => {
        const { factory, membro } = await criarContexto();
        const { foto } = await new GerirFotoPerfil(factory).trocar(membro.codigo, webp());
        expect(foto).toMatch(NOME_FOTO);
        expect((await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo))!.foto).toBe(foto);
        expect(factory.armazenamentoFotos.arquivos.has(foto)).toBe(true);
    });

    it("trocar de novo apaga a foto antiga", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        const { foto: antiga } = await caso.trocar(membro.codigo, webp());
        const { foto } = await caso.trocar(membro.codigo, webp());
        expect(foto).not.toBe(antiga);
        expect(factory.armazenamentoFotos.arquivos.has(antiga)).toBe(false);
        expect(factory.armazenamentoFotos.arquivos.has(foto)).toBe(true);
    });

    it("recusa PNG, corpo vazio e arquivo grande", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        const png = Buffer.concat([Buffer.from([0x89]), Buffer.from("PNG\r\n\x1a\n"), Buffer.alloc(20)]);
        await expect(caso.trocar(membro.codigo, png)).rejects.toMatchObject({
            codigo: "FOTO_FORMATO_INVALIDO",
            message: "A foto tem que ser uma imagem WebP.",
        });
        await expect(caso.trocar(membro.codigo, Buffer.alloc(0))).rejects.toMatchObject({ codigo: "FOTO_FORMATO_INVALIDO" });
        await expect(caso.trocar(membro.codigo, webp(300 * 1024 + 1 - 12))).rejects.toMatchObject({
            codigo: "FOTO_GRANDE_DEMAIS",
            message: "A foto pode ter até 300 KB.",
        });
        expect(factory.armazenamentoFotos.arquivos.size).toBe(0);
    });

    it("aceita exatamente 300 KB", async () => {
        const { factory, membro } = await criarContexto();
        await expect(new GerirFotoPerfil(factory).trocar(membro.codigo, webp(300 * 1024 - 12))).resolves.toBeDefined();
    });

    it("se gravar no repositório falha, apaga o arquivo novo e mantém o antigo", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        const { foto: antiga } = await caso.trocar(membro.codigo, webp());
        const repo = factory.criarUsuarioRepository();
        jest.spyOn(repo, "definirFoto").mockRejectedValueOnce(new Error("banco fora"));
        await expect(caso.trocar(membro.codigo, webp())).rejects.toThrow("banco fora");
        expect([...factory.armazenamentoFotos.arquivos.keys()]).toEqual([antiga]);
        expect((await repo.buscarPorCodigo(membro.codigo))!.foto).toBe(antiga);
    });

    it("se apagar a foto antiga falha, a troca vale e avisa no console", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        const { foto: antiga } = await caso.trocar(membro.codigo, webp());
        const aviso = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.spyOn(factory.armazenamentoFotos, "excluir").mockRejectedValueOnce(new Error("disco cheio"));
        try {
            const { foto } = await caso.trocar(membro.codigo, webp());
            expect(foto).not.toBe(antiga);
            expect((await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo))!.foto).toBe(foto);
            expect(aviso).toHaveBeenCalledTimes(1);
        } finally {
            aviso.mockRestore();
        }
    });

    it("remover limpa a foto e apaga o arquivo; sem foto não falha", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        await caso.trocar(membro.codigo, webp());
        await caso.remover(membro.codigo);
        expect((await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo))!.foto).toBeNull();
        expect(factory.armazenamentoFotos.arquivos.size).toBe(0);
        await expect(caso.remover(membro.codigo)).resolves.toBeUndefined();
    });

    it("inativar a pessoa não mexe na foto", async () => {
        const { factory, membro } = await criarContexto();
        const { foto } = await new GerirFotoPerfil(factory).trocar(membro.codigo, webp());
        await new AlterarStatusPessoa(factory).execute({ codigo: membro.codigo, status: StatusPessoa.INATIVO });
        expect((await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo))!.foto).toBe(foto);
        expect(factory.armazenamentoFotos.arquivos.has(foto)).toBe(true);
    });
});
