import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import Router from "../source/infra/http/Router";
import { MODULOS, menuDoUsuario, menuOrdenado } from "../source/modulos/registro";
import { Permissao, TODAS_AS_PERMISSOES, permissoesDoPapel } from "../source/shared/seguranca/catalogoPermissoes";
import { exigirPermissao, exigirPodeGerirPerfil, resolverUsuarioAlvo, temPermissao } from "../source/shared/seguranca/permissoes";
import { ErroProibido } from "../source/shared/erros/ErroProibido";
import { ErroNaoAutorizado } from "../source/shared/erros/ErroNaoAutorizado";
import { criarContexto } from "./fixtures";

const diretor = { codigo: "d", perfil: PerfilUsuario.DIRETOR };
const gerente = { codigo: "g", perfil: PerfilUsuario.GERENTE };
const membro = { codigo: "m", perfil: PerfilUsuario.MEMBRO };

describe("Catálogo de permissões", () => {
    test("diretor tem todas; gerente não exclui projeto nem configura; membro nenhuma", () => {
        expect(permissoesDoPapel(PerfilUsuario.DIRETOR).sort()).toEqual([...TODAS_AS_PERMISSOES].sort());
        expect(temPermissao(gerente, Permissao.PROJETOS_EDITAR)).toBe(true);
        expect(temPermissao(gerente, Permissao.PROJETOS_EXCLUIR)).toBe(false);
        expect(temPermissao(gerente, Permissao.CONFIGURACOES_EDITAR)).toBe(false);
        expect(permissoesDoPapel(PerfilUsuario.MEMBRO)).toEqual([]);
        expect(permissoesDoPapel("desconhecido")).toEqual([]);
    });

    test("exigirPermissao recusa sem login e sem permissão", () => {
        expect(() => exigirPermissao(null, Permissao.PROJETOS_EDITAR)).toThrow(ErroNaoAutorizado);
        expect(() => exigirPermissao(membro, Permissao.PROJETOS_EDITAR)).toThrow(ErroProibido);
        expect(exigirPermissao(gerente, Permissao.PROJETOS_EDITAR)).toBe(gerente);
    });

    test("só quem gere diretores mexe em diretor", () => {
        expect(() => exigirPodeGerirPerfil(gerente, null, PerfilUsuario.DIRETOR)).toThrow(ErroProibido);
        expect(() => exigirPodeGerirPerfil(gerente, PerfilUsuario.DIRETOR, PerfilUsuario.MEMBRO)).toThrow(ErroProibido);
        expect(exigirPodeGerirPerfil(gerente, PerfilUsuario.MEMBRO, PerfilUsuario.GERENTE)).toBe(gerente);
        expect(exigirPodeGerirPerfil(diretor, null, PerfilUsuario.DIRETOR)).toBe(diretor);
        expect(() => exigirPodeGerirPerfil(membro, null, PerfilUsuario.MEMBRO)).toThrow(ErroProibido);
    });

    test("membro só age por si; gestor pode indicar outra pessoa", () => {
        expect(resolverUsuarioAlvo(membro, null, Permissao.CAPACITACOES_GERIR)).toBe("m");
        expect(() => resolverUsuarioAlvo(membro, "x", Permissao.CAPACITACOES_GERIR)).toThrow(ErroProibido);
        expect(resolverUsuarioAlvo(gerente, "x", Permissao.CAPACITACOES_GERIR)).toBe("x");
    });
});

describe("Registro de módulos", () => {
    test("cada ação do catálogo pertence a exatamente um módulo", () => {
        const declaradas = MODULOS.flatMap((m) => m.permissoes);
        expect([...declaradas].sort()).toEqual([...TODAS_AS_PERMISSOES].sort());
        expect(new Set(MODULOS.map((m) => m.chave)).size).toBe(MODULOS.length);
    });

    test("menu esconde itens sem permissão", () => {
        const chaves = (u: any) => menuDoUsuario(u).map((m) => m.chave);
        const telas = (u: any) => menuOrdenado(u).map((i) => i.chave);
        expect(telas(diretor)).toEqual([
            "dashboard",
            "tarefas",
            "projetos",
            "agenda",
            "capacitacoes",
            "biblioteca",
            "estrategia",
            "precificacao",
            "usuarios",
            "configuracoes",
        ]);
        expect(telas(gerente)).toEqual(telas(diretor).filter((t) => t !== "configuracoes"));
        expect(telas(membro)).toEqual(["dashboard", "tarefas", "projetos", "agenda", "capacitacoes", "biblioteca"]);
        // Biblioteca (sessão 17): sem permissão no menu; o membro vê o módulo.
        expect(menuDoUsuario(membro).find((m) => m.chave === "biblioteca")?.itens).toEqual([
            { chave: "biblioteca", rotulo: "Biblioteca", caminho: "/biblioteca" },
        ]);
        // "Meu perfil" abre pelo avatar do topo (sessão 22): o membro não vê o módulo Pessoas no menu.
        expect(chaves(membro)).not.toContain("pessoas");
        expect(MODULOS.flatMap((m) => m.menu.map((i) => i.chave))).not.toContain("perfil");
        expect(chaves(membro)).not.toContain("config");
        expect(new Set(MODULOS.flatMap((m) => m.menu.map((i) => i.chave))).size).toBe(MODULOS.flatMap((m) => m.menu).length);
    });

    test("Router registra as rotas de todos os módulos e expõe /auth/permissoes", async () => {
        const rotas: Record<string, any> = {};
        const http: any = {
            route: (metodo: string, url: string, _auth: boolean, cb: any) => {
                rotas[`${metodo} ${url}`] = cb;
            },
            swagger: () => undefined,
        };
        new Router(http, new MemoryRepositoryFactory()).init();

        for (const rota of ["get /usuarios", "get /projetos", "get /tarefas", "get /capacitacoes", "get /areas", "get /biblioteca"]) {
            expect(rotas[rota]).toBeDefined();
        }
        const resposta = await rotas["get /auth/permissoes"]({}, { user: gerente });
        expect(resposta.permissoes).toContain(Permissao.PROJETOS_EDITAR);
        expect(resposta.menu.map((i: any) => i.chave)).toContain("usuarios");
        const deMembro = await rotas["get /auth/permissoes"]({}, { user: membro });
        expect(deMembro.menu.map((i: any) => i.chave)).not.toContain("usuarios");
        await expect(rotas["get /auth/permissoes"]({}, {})).rejects.toThrow(ErroNaoAutorizado);
    });
});

describe("PUT /auth/perfil", () => {
    test("a pessoa edita só os próprios dados de contato", async () => {
        const { factory, membro: ana } = await criarContexto();
        const rotas: Record<string, any> = {};
        const http: any = {
            route: (metodo: string, url: string, _auth: boolean, cb: any) => {
                rotas[`${metodo} ${url}`] = cb;
            },
            swagger: () => undefined,
        };
        new Router(http, factory).init();
        const eu = { codigo: ana.codigo, perfil: ana.perfil };

        const editado = await rotas["put /auth/perfil"](
            {},
            {
                user: eu,
                telefone: "47 99999-0000",
                bio: "Oi",
                curso: "Engenharia Mecânica",
                // Ignorados: só a gestão muda nome, e-mail, perfil e área.
                nome: "Outro",
                email: "x@y.com",
                perfil: PerfilUsuario.DIRETOR,
                codigoArea: "qualquer",
            },
        );
        expect(editado.telefone).toBe("47 99999-0000");
        expect(editado.bio).toBe("Oi");
        expect(editado.nome).toBe(ana.nome);
        expect(editado.email).toBe(ana.email);
        expect(editado.perfil).toBe(ana.perfil);
        await expect(rotas["put /auth/perfil"]({}, { telefone: "1" })).rejects.toThrow(ErroNaoAutorizado);
    });

    test("PUT /usuarios/:codigo (gestão) grava fimTrainee e devolve no corpo", async () => {
        const { factory, membro: ana, gerente } = await criarContexto();
        const rotas: Record<string, any> = {};
        const http: any = { route: (m: string, u: string, _a: boolean, cb: any) => (rotas[`${m} ${u}`] = cb), swagger: () => undefined };
        new Router(http, factory).init();
        const r = await rotas["put /usuarios/:codigo"](
            { codigo: ana.codigo },
            { user: { codigo: gerente.codigo, perfil: gerente.perfil }, fimTrainee: "2026-11-10T15:00:00Z", dataEntrada: "2026-01-01" },
        );
        expect(new Date(r.fimTrainee).toISOString().slice(0, 10)).toBe("2026-11-10");
        const lido = await factory.criarUsuarioRepository().buscarPorCodigo(ana.codigo);
        expect(lido!.fimTrainee!.toISOString().slice(0, 10)).toBe("2026-11-10");
    });

    test("e-mail pessoal grava e outro membro lê; fimTrainee da própria pessoa é ignorado", async () => {
        const { factory, membro: ana, gerente } = await criarContexto();
        const rotas: Record<string, any> = {};
        const http: any = { route: (m: string, u: string, _a: boolean, cb: any) => (rotas[`${m} ${u}`] = cb), swagger: () => undefined };
        new Router(http, factory).init();
        const eu = { codigo: ana.codigo, perfil: ana.perfil };
        const r = await rotas["put /auth/perfil"]({}, { user: eu, emailPessoal: "Ana@Gmail.com", fimTrainee: "2026-01-01" });
        expect(r.emailPessoal).toBe("ana@gmail.com");
        expect(r.fimTrainee ?? null).toBeNull();
        const visto = await rotas["get /usuarios/:codigo"](
            { codigo: ana.codigo },
            { user: { codigo: gerente.codigo, perfil: gerente.perfil } },
        );
        expect(visto.emailPessoal).toBe("ana@gmail.com");
        await expect(rotas["put /auth/perfil"]({}, { user: eu, emailPessoal: "sem-arroba" })).rejects.toMatchObject({
            codigo: "EMAIL_PESSOAL_INVALIDO",
        });
    });
});
