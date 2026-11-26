import { criarContexto } from "./fixtures";
import Projeto from "../source/domain/entity/Projeto";
import Participacao from "../source/domain/entity/Participacao";
import Usuario from "../source/domain/entity/Usuario";
import ItemBiblioteca from "../source/domain/entity/ItemBiblioteca";
import SigiloBiblioteca from "../source/domain/enum/SigiloBiblioteca";
import { ErroProibido } from "../source/shared/erros/ErroProibido";
import { ErroNaoEncontrado } from "../source/shared/erros/ErroNaoEncontrado";
import { PADRAO_DIRETOR, PADRAO_GERENTE, PADRAO_MEMBRO, Permissao } from "../source/shared/seguranca/catalogoPermissoes";
import {
    exigirAlterarItem,
    exigirPodeUsarSigiloEProjeto,
    exigirVerItem,
    podeAlterarItem,
    podeVerItem,
    podeVerProjetoDoItem,
    contextoProjetos,
} from "../source/shared/seguranca/regrasBiblioteca";
import { autenticado, comPapel, efetivasDoPapel } from "./papel";

const inicio = new Date("2026-10-01T00:00:00.000Z");
const saida = new Date("2026-10-20T00:00:00.000Z");

async function montar() {
    const { factory, membro, gerente, senioridade } = await criarContexto();
    const outro = comPapel(new Usuario("Beto Lima", "beto@konvex.com.br", true, "senha-hash", senioridade, "usr-beto"), "membro");
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
    const u = (x: Usuario) => autenticado(x);
    const diretor = { codigo: "usr-dir", ...efetivasDoPapel("diretor") };
    return { factory, membro: u(membro), gerente: u(gerente), diretor, outro: u(outro), outroUsuario: outro, item };
}

describe("regras da Biblioteca", () => {
    it("gerente (biblioteca.verTodos) vê os três sigilos", async () => {
        const { factory, gerente, item } = await montar();
        const ctx = await contextoProjetos(gerente, factory);
        for (const i of [item("todos"), item("gestao"), item("projeto", "p-alheio")]) {
            expect(podeVerItem(gerente, i, ctx)).toBe(true);
        }
    });

    it("membro vê todos, projeto do seu e do que saiu; não vê gestao nem projeto alheio", async () => {
        const { factory, membro, item } = await montar();
        const ctx = await contextoProjetos(membro, factory);
        expect([...ctx.completos].sort()).toEqual(["p-antigo", "p-meu"]);
        expect(podeVerItem(membro, item("todos"), ctx)).toBe(true);
        expect(podeVerItem(membro, item("projeto", "p-meu"), ctx)).toBe(true);
        expect(podeVerItem(membro, item("projeto", "p-antigo"), ctx)).toBe(true);
        expect(podeVerItem(membro, item("gestao"), ctx)).toBe(false);
        expect(podeVerItem(membro, item("projeto", "p-alheio"), ctx)).toBe(false);
    });

    it("projeto que a pessoa não abre: item 'todos' segue visível com o projeto nulo; ligar item a ele não", async () => {
        const { factory, membro, item } = await montar();
        const ctx = await contextoProjetos(membro, factory);
        expect(podeVerItem(membro, item("todos", "p-alheio"), ctx)).toBe(true);
        expect(podeVerProjetoDoItem(membro, "p-alheio", ctx)).toBe(false);
        expect(podeVerProjetoDoItem(membro, "p-meu", ctx)).toBe(true);
        await expect(exigirPodeUsarSigiloEProjeto(membro, SigiloBiblioteca.TODOS, "p-alheio", factory)).rejects.toThrow(ErroProibido);
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
        const { factory, membro, gerente, diretor } = await montar();
        const G = SigiloBiblioteca.GESTAO,
            P = SigiloBiblioteca.PROJETO,
            T = SigiloBiblioteca.TODOS;
        await expect(exigirPodeUsarSigiloEProjeto(membro, G, null, factory)).rejects.toThrow(ErroProibido);
        await expect(exigirPodeUsarSigiloEProjeto(membro, P, "p-alheio", factory)).rejects.toThrow(ErroProibido);
        await expect(exigirPodeUsarSigiloEProjeto(membro, T, "p-alheio", factory)).rejects.toThrow(ErroProibido);
        await expect(exigirPodeUsarSigiloEProjeto(membro, P, "p-antigo", factory)).resolves.toBeUndefined();
        await expect(exigirPodeUsarSigiloEProjeto(membro, T, "p-meu", factory)).resolves.toBeUndefined();
        await expect(exigirPodeUsarSigiloEProjeto(membro, T, null, factory)).resolves.toBeUndefined();
        // 31a: ligar item a projeto exige abri-lo, também para quem gere a Biblioteca.
        await expect(exigirPodeUsarSigiloEProjeto(gerente, G, null, factory)).resolves.toBeUndefined();
        const gerenteDaArea = { codigo: "usr-gda", ...efetivasDoPapel("gerenteDaArea") };
        await expect(exigirPodeUsarSigiloEProjeto(gerenteDaArea, P, "p-alheio", factory)).rejects.toThrow(ErroProibido);
        await expect(exigirPodeUsarSigiloEProjeto(diretor, P, "p-alheio", factory)).resolves.toBeUndefined();
    });

    it("catálogo: gestão tem as duas permissões; membro nenhuma", () => {
        expect(PADRAO_GERENTE).toEqual(expect.arrayContaining([Permissao.BIBLIOTECA_VER_TODOS, Permissao.BIBLIOTECA_GERIR]));
        expect(PADRAO_DIRETOR).toEqual(expect.arrayContaining([Permissao.BIBLIOTECA_VER_TODOS, Permissao.BIBLIOTECA_GERIR]));
        expect(PADRAO_MEMBRO).not.toContain(Permissao.BIBLIOTECA_GERIR);
        expect(PADRAO_MEMBRO).not.toContain(Permissao.BIBLIOTECA_VER_TODOS);
    });
});
