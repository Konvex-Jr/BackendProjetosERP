import {
    CATALOGO,
    ehPermissao,
    PADRAO_DIRETOR,
    PADRAO_GERENTE,
    PADRAO_MEMBRO,
    PADRAO_TRAINEE,
    Permissao,
    TODAS_AS_PERMISSOES,
} from "../source/shared/seguranca/catalogoPermissoes";

describe("catálogo de permissões (sessão 31a)", () => {
    test("cada permissão aparece uma vez no catálogo, com rótulo, descrição e grupo", () => {
        const chaves = CATALOGO.map((i) => i.chave);
        expect(new Set(chaves).size).toBe(chaves.length);
        expect([...chaves].sort()).toEqual([...TODAS_AS_PERMISSOES].sort());
        for (const info of CATALOGO) {
            expect(info.rotulo.trim()).not.toBe("");
            expect(info.descricao.trim()).not.toBe("");
            expect(info.grupo.trim()).not.toBe("");
        }
    });

    test("chaves antigas não são mais permissões", () => {
        expect(ehPermissao("projetos.verTodos")).toBe(false);
        expect(ehPermissao("projetos.verSigilosos")).toBe(false);
        expect(ehPermissao("pessoas.gerirDiretores")).toBe(false);
        expect(ehPermissao("configuracoes.editar")).toBe(false);
        expect(ehPermissao("projetos.abrirDaArea")).toBe(true);
        expect(ehPermissao(42)).toBe(false);
    });

    test("gerente abre os projetos da área, não todos", () => {
        expect(PADRAO_GERENTE).toContain(Permissao.PROJETOS_ABRIR_DA_AREA);
        expect(PADRAO_GERENTE).not.toContain(Permissao.PROJETOS_ABRIR_TODOS);
        expect(PADRAO_GERENTE).not.toContain(Permissao.CLIENTES_VER);
        expect(PADRAO_GERENTE).not.toContain(Permissao.PERMISSOES_GERIR);
        expect(PADRAO_GERENTE).toContain(Permissao.ESTRATEGIA_VER);
        expect(PADRAO_GERENTE).toContain(Permissao.PRECIFICACAO_SIMULAR);
    });

    test("trainee sem Biblioteca e sem liderar projeto; membro com os dois", () => {
        expect(PADRAO_TRAINEE).not.toContain(Permissao.BIBLIOTECA_USAR);
        expect(PADRAO_TRAINEE).not.toContain(Permissao.PROJETOS_LIDERAR);
        expect(PADRAO_MEMBRO).toContain(Permissao.BIBLIOTECA_USAR);
        expect(PADRAO_MEMBRO).toContain(Permissao.PROJETOS_LIDERAR);
        expect(PADRAO_TRAINEE).toContain(Permissao.REUNIOES_CRIAR);
    });

    test("todo padrão usa só permissões do catálogo; diretor tem todas", () => {
        for (const padrao of [PADRAO_DIRETOR, PADRAO_GERENTE, PADRAO_MEMBRO, PADRAO_TRAINEE]) {
            for (const p of padrao) expect(TODAS_AS_PERMISSOES).toContain(p);
        }
        expect([...PADRAO_DIRETOR].sort()).toEqual([...TODAS_AS_PERMISSOES].sort());
    });
});
