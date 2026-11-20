import sharp from "sharp";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import GerirFotoPerfil from "../source/useCases/pessoas/GerirFotoPerfil";
import { NOME_FOTO } from "../source/shared/foto";
import AlterarStatusPessoa from "../source/useCases/pessoas/AlterarStatusPessoa";
import { criarContexto } from "./fixtures";

// Imagens de verdade: o servidor decodifica e regrava a foto (sharp).
const imagem = (formato: "webp" | "jpeg" | "png", largura = 300, altura = 200) =>
    sharp({ create: { width: largura, height: altura, channels: 3, background: "#ff6a33" } })
        .toFormat(formato)
        .toBuffer();
const webp = () => imagem("webp");
// JPEG com bytes depois do fim da imagem até `total`: o decodificador ignora, o tamanho é exato.
const jpegCom = async (total: number) => {
    const base = await imagem("jpeg");
    return Buffer.concat([base, Buffer.alloc(total - base.length)]);
};

describe("foto de perfil (sessão 22)", () => {
    it("trocar grava o arquivo e a foto do usuário", async () => {
        const { factory, membro } = await criarContexto();
        const { foto } = await new GerirFotoPerfil(factory).trocar(membro.codigo, await webp());
        expect(foto).toMatch(NOME_FOTO);
        expect((await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo))!.foto).toBe(foto);
        expect(factory.armazenamentoFotos.arquivos.has(foto)).toBe(true);
    });

    it("trocar de novo apaga a foto antiga", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        const { foto: antiga } = await caso.trocar(membro.codigo, await webp());
        const { foto } = await caso.trocar(membro.codigo, await webp());
        expect(foto).not.toBe(antiga);
        expect(factory.armazenamentoFotos.arquivos.has(antiga)).toBe(false);
        expect(factory.armazenamentoFotos.arquivos.has(foto)).toBe(true);
    });

    it("aceita JPEG, PNG e WebP e grava sempre WebP 256x256", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        for (const formato of ["jpeg", "png", "webp"] as const) {
            const { foto } = await caso.trocar(membro.codigo, await imagem(formato, 400, 300));
            const gravada = await sharp(factory.armazenamentoFotos.arquivos.get(foto)!).metadata();
            expect([formato, gravada.format, gravada.width, gravada.height]).toEqual([formato, "webp", 256, 256]);
        }
    });

    it("recusa GIF, SVG, corpo vazio, imagem corrompida e arquivo grande", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        const invalido = { codigo: "FOTO_FORMATO_INVALIDO", message: "A foto tem que ser uma imagem JPEG, PNG ou WebP." };
        await expect(caso.trocar(membro.codigo, await imagem("gif" as any))).rejects.toMatchObject(invalido);
        await expect(caso.trocar(membro.codigo, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).rejects.toMatchObject(invalido);
        await expect(caso.trocar(membro.codigo, Buffer.alloc(0))).rejects.toMatchObject(invalido);
        const corrompido = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBP"), Buffer.alloc(40, 7)]);
        await expect(caso.trocar(membro.codigo, corrompido)).rejects.toMatchObject(invalido);
        await expect(caso.trocar(membro.codigo, await jpegCom(300 * 1024 + 1))).rejects.toMatchObject({
            codigo: "FOTO_GRANDE_DEMAIS",
            message: "A foto pode ter até 300 KB.",
        });
        expect(factory.armazenamentoFotos.arquivos.size).toBe(0);
    });

    it("aceita exatamente 300 KB", async () => {
        const { factory, membro } = await criarContexto();
        await expect(new GerirFotoPerfil(factory).trocar(membro.codigo, await jpegCom(300 * 1024))).resolves.toBeDefined();
    });

    it("se gravar no repositório falha, apaga o arquivo novo e mantém o antigo", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        const { foto: antiga } = await caso.trocar(membro.codigo, await webp());
        const repo = factory.criarUsuarioRepository();
        jest.spyOn(repo, "definirFoto").mockRejectedValueOnce(new Error("banco fora"));
        await expect(caso.trocar(membro.codigo, await webp())).rejects.toThrow("banco fora");
        expect([...factory.armazenamentoFotos.arquivos.keys()]).toEqual([antiga]);
        expect((await repo.buscarPorCodigo(membro.codigo))!.foto).toBe(antiga);
    });

    it("se apagar a foto antiga falha, a troca vale e avisa no console", async () => {
        const { factory, membro } = await criarContexto();
        const caso = new GerirFotoPerfil(factory);
        const { foto: antiga } = await caso.trocar(membro.codigo, await webp());
        const aviso = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.spyOn(factory.armazenamentoFotos, "excluir").mockRejectedValueOnce(new Error("disco cheio"));
        try {
            const { foto } = await caso.trocar(membro.codigo, await webp());
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
        await caso.trocar(membro.codigo, await webp());
        await caso.remover(membro.codigo);
        expect((await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo))!.foto).toBeNull();
        expect(factory.armazenamentoFotos.arquivos.size).toBe(0);
        await expect(caso.remover(membro.codigo)).resolves.toBeUndefined();
    });

    it("inativar a pessoa não mexe na foto", async () => {
        const { factory, membro } = await criarContexto();
        const { foto } = await new GerirFotoPerfil(factory).trocar(membro.codigo, await webp());
        await new AlterarStatusPessoa(factory).execute({ codigo: membro.codigo, status: StatusPessoa.INATIVO, motivoSaida: "Formou-se" });
        expect((await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo))!.foto).toBe(foto);
        expect(factory.armazenamentoFotos.arquivos.has(foto)).toBe(true);
    });
});
