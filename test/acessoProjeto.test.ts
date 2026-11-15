import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import { ErroAplicacao } from "../source/shared/erros/ErroAplicacao";
import { acessoAoProjeto, exigirAcessoCompleto, podeGerirAcesso, ProjetoParaAcesso } from "../source/shared/seguranca/visibilidadeProjetos";

const usuario = (codigo: string, perfil: PerfilUsuario) => ({ codigo, perfil });
const diretor = usuario("d", PerfilUsuario.DIRETOR);
const gerente = usuario("g", PerfilUsuario.GERENTE);
const gerenteNaLista = usuario("gl", PerfilUsuario.GERENTE);
const criador = usuario("c", PerfilUsuario.MEMBRO);
const naLista = usuario("l", PerfilUsuario.MEMBRO);
const equipe = usuario("e", PerfilUsuario.MEMBRO);
const exEquipe = usuario("x", PerfilUsuario.MEMBRO);
const fora = usuario("f", PerfilUsuario.MEMBRO);

const participacoes = [
    { usuario: { codigo: "e" }, ativa: true },
    { usuario: { codigo: "x" }, ativa: false },
];
const sigiloso: ProjetoParaAcesso = { sigiloso: true, criadoPor: "c", acesso: ["l", "gl"], participacoes };
const normal: ProjetoParaAcesso = { sigiloso: false, criadoPor: "c", acesso: [], participacoes };

describe("acessoAoProjeto", () => {
    test.each([
        ["diretor", diretor, "completo"],
        ["criador", criador, "completo"],
        ["pessoa na lista de acesso", naLista, "completo"],
        ["equipe atual", equipe, "completo"],
        ["ex-equipe", exEquipe, "nada"],
        ["gerente fora", gerente, "resumo"],
        ["membro fora", fora, "nada"],
    ])("projeto sigiloso: %s", (_nome, quem, esperado) => {
        expect(acessoAoProjeto(quem, sigiloso)).toBe(esperado);
    });

    test.each([
        ["gerente", gerente, "completo"],
        ["ex-equipe (participou)", exEquipe, "completo"],
        ["membro fora", fora, "nada"],
    ])("projeto normal: %s", (_nome, quem, esperado) => {
        expect(acessoAoProjeto(quem, normal)).toBe(esperado);
    });
});

describe("podeGerirAcesso", () => {
    test.each([
        ["diretor", diretor, true],
        ["criador", criador, true],
        ["gerente na lista", gerenteNaLista, false],
    ])("%s", (_nome, quem, esperado) => {
        expect(podeGerirAcesso(quem, sigiloso)).toBe(esperado);
    });
});

describe("exigirAcessoCompleto", () => {
    function erroDe(quem: typeof fora, projeto: ProjetoParaAcesso): ErroAplicacao {
        try {
            exigirAcessoCompleto(quem, projeto);
        } catch (e) {
            return e as ErroAplicacao;
        }
        throw new Error("Era esperado um erro.");
    }

    test("membro fora de sigiloso recebe 404", () => {
        expect(erroDe(fora, sigiloso).codigoHttp).toBe(404);
    });

    test("gerente fora de sigiloso recebe 403 PROJETO_SIGILOSO", () => {
        const erro = erroDe(gerente, sigiloso);
        expect(erro.codigoHttp).toBe(403);
        expect(erro.codigo).toBe("PROJETO_SIGILOSO");
    });

    test("membro fora de projeto normal recebe 403", () => {
        expect(erroDe(fora, normal).codigoHttp).toBe(403);
    });

    test("quem tem acesso completo recebe o usuário de volta", () => {
        expect(exigirAcessoCompleto(equipe, sigiloso)).toBe(equipe);
    });
});
