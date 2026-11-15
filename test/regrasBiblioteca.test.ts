import { criarContexto } from "./fixtures";
import Projeto from "../source/domain/entity/Projeto";
import Participacao from "../source/domain/entity/Participacao";
import Usuario from "../source/domain/entity/Usuario";
import ItemBiblioteca from "../source/domain/entity/ItemBiblioteca";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import SigiloBiblioteca from "../source/domain/enum/SigiloBiblioteca";
import { ErroProibido } from "../source/shared/erros/ErroProibido";
import { ErroNaoEncontrado } from "../source/shared/erros/ErroNaoEncontrado";
import { permissoesDoPapel, Permissao } from "../source/shared/seguranca/catalogoPermissoes";
import {
    exigirAlterarItem,
    exigirPodeUsarSigiloEProjeto,
    exigirVerItem,
    podeAlterarItem,
    podeVerItem,
    podeVerProjetoDoItem,
    contextoProjetos,
} from "../source/shared/seguranca/regrasBiblioteca";

const inicio = new Date("2026-10-01T00:00:00.000Z");
const saida = new Date("2026-10-20T00:00:00.000Z");

async function montar() {
    const { factory, membro, gerente, senioridade } = await criarContexto();
    const outro = new Usuario("Beto Lima", "beto@konvex.com.br", PerfilUsuario.MEMBRO, true, "senha-hash", senioridade, "usr-beto");
    await factory.criarUsuarioRepository().criar(outro);
    const repo = factory.criarProjetoRepository();
    await repo.criar(new Projeto("Meu", "d", inicio, saida, undefined, [membro], "p-meu"));
    await repo.criar(new Projeto("Alheio", "d", inicio, saida, undefined, [outro], "p-alheio"));
    await repo.criar(
        new Projeto(
            "Antigo",
            "d",
            inicio,
            saida,
            undefined,
            [new Participacao(membro, { dataEntrada: inicio, dataSaida: saida })],
            "p-antigo",
        ),
    );
    const ref = (codigo: string) => ({ codigo, nome: codigo });
    const item = (sigilo: string, projeto: string | null = null, autor = outro) =>
        new ItemBiblioteca({ titulo: "Item", sigilo, projeto: projeto ? ref(projeto) : null, autor: ref(autor.codigo) });
    const u = (x: Usuario) => ({ codigo: x.codigo, perfil: x.perfil });
    return { factory, membro: u(membro), gerente: u(gerente), outro: u(outro), outroUsuario: outro, item };
}

describe("regras da Biblioteca", () => {
    it("gerente vê os três sigilos", async () => {
        const { factory, gerente, item } = await montar();
        const meus = await contextoProjetos(gerente, factory);
        expect(meus.meus.size).toBe(0);
        for (const i of [item("todos"), item("gestao"), item("projeto", "p-alheio")]) {
            expect(podeVerItem(gerente, i, meus)).toBe(true);
        }
    });

    it("membro vê todos, projeto do seu e do que saiu; não vê gestao nem projeto alheio", async () => {
        const { factory, membro, item } = await montar();
        const meus = await contextoProjetos(membro, factory);
        expect([...meus.meus].sort()).toEqual(["p-antigo", "p-meu"]);
        expect(podeVerItem(membro, item("todos"), meus)).toBe(true);
        expect(podeVerItem(membro, item("projeto", "p-meu"), meus)).toBe(true);
        expect(podeVerItem(membro, item("projeto", "p-antigo"), meus)).toBe(true);
        expect(podeVerItem(membro, item("gestao"), meus)).toBe(false);
        expect(podeVerItem(membro, item("projeto", "p-alheio"), meus)).toBe(false);
    });

    it("sigiloso oculto: nem a gestão vê item ligado a ele, nem liga item a ele", async () => {
        const { factory, gerente, membro, outro, outroUsuario, item } = await montar();
        await factory
            .criarProjetoRepository()
            .criar(
                new Projeto("Secreto", "d", inicio, saida, undefined, [outroUsuario], "p-sec", { sigiloso: true, criadoPor: outro.codigo }),
            );
        const ctxGerente = await contextoProjetos(gerente, factory);
        expect([...ctxGerente.ocultos]).toEqual(["p-sec"]);
        expect(podeVerItem(gerente, item("todos", "p-sec"), ctxGerente)).toBe(false);
        expect(podeVerProjetoDoItem(gerente, "p-sec", ctxGerente)).toBe(false);
        await expect(exigirPodeUsarSigiloEProjeto(gerente, SigiloBiblioteca.TODOS, "p-sec", factory)).rejects.toThrow(ErroProibido);
        const ctxDono = await contextoProjetos(outro, factory);
        expect(ctxDono.ocultos.size).toBe(0);
        expect(ctxDono.meus.has("p-sec")).toBe(true);
        expect(podeVerItem(outro, item("projeto", "p-sec"), ctxDono)).toBe(true);
        expect((await contextoProjetos(membro, factory)).meus.has("p-sec")).toBe(false);
    });

    it("exigirVerItem responde 404 para item invisível ou nulo", async () => {
        const { factory, membro, item } = await montar();
        await expect(exigirVerItem(membro, item("gestao"), factory)).rejects.toThrow(ErroNaoEncontrado);
        await expect(exigirVerItem(membro, null, factory)).rejects.toThrow("Item não encontrado.");
        const visivel = item("todos");
        await expect(exigirVerItem(membro, visivel, factory)).resolves.toBe(visivel);
    });

    it("podeAlterarItem: autor sim, outro membro não, gerente sim", async () => {
        const { membro, gerente, outro, item } = await montar();
        const doOutro = item("todos");
        expect(podeAlterarItem(outro, doOutro)).toBe(true);
        expect(podeAlterarItem(membro, doOutro)).toBe(false);
        expect(podeAlterarItem(gerente, doOutro)).toBe(true);
        expect(podeAlterarItem(null, doOutro)).toBe(false);
        expect(() => exigirAlterarItem(membro, doOutro)).toThrow(ErroProibido);
        expect(exigirAlterarItem(outro, doOutro)).toBe(outro);
    });

    it("exigirPodeUsarSigiloEProjeto", async () => {
        const { factory, membro, gerente } = await montar();
        const G = SigiloBiblioteca.GESTAO,
            P = SigiloBiblioteca.PROJETO,
            T = SigiloBiblioteca.TODOS;
        await expect(exigirPodeUsarSigiloEProjeto(membro, G, null, factory)).rejects.toThrow(ErroProibido);
        await expect(exigirPodeUsarSigiloEProjeto(membro, P, "p-alheio", factory)).rejects.toThrow(ErroProibido);
        await expect(exigirPodeUsarSigiloEProjeto(membro, T, "p-alheio", factory)).rejects.toThrow(ErroProibido);
        await expect(exigirPodeUsarSigiloEProjeto(membro, P, "p-antigo", factory)).resolves.toBeUndefined();
        await expect(exigirPodeUsarSigiloEProjeto(membro, T, "p-meu", factory)).resolves.toBeUndefined();
        await expect(exigirPodeUsarSigiloEProjeto(membro, T, null, factory)).resolves.toBeUndefined();
        await expect(exigirPodeUsarSigiloEProjeto(gerente, G, "p-alheio", factory)).resolves.toBeUndefined();
        await expect(exigirPodeUsarSigiloEProjeto(gerente, P, "p-alheio", factory)).resolves.toBeUndefined();
    });

    it("catálogo: gestão tem as duas permissões; membro nenhuma", () => {
        expect(permissoesDoPapel(PerfilUsuario.GERENTE)).toEqual(
            expect.arrayContaining([Permissao.BIBLIOTECA_VER_TODOS, Permissao.BIBLIOTECA_GERIR]),
        );
        expect(permissoesDoPapel(PerfilUsuario.DIRETOR)).toEqual(
            expect.arrayContaining([Permissao.BIBLIOTECA_VER_TODOS, Permissao.BIBLIOTECA_GERIR]),
        );
        expect(permissoesDoPapel(PerfilUsuario.MEMBRO)).toEqual([]);
    });
});
