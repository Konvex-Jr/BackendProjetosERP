import StatusPessoa from "../source/domain/enum/StatusPessoa";
import { ErroAplicacao } from "../source/shared/erros/ErroAplicacao";
import { UsuarioAutenticado } from "../source/shared/seguranca/permissoes";
import {
    acessoAoProjeto,
    exigirAcessoCompleto,
    exigirNaoSeTrancar,
    ProjetoParaAcesso,
} from "../source/shared/seguranca/visibilidadeProjetos";
import { Papel, efetivasDoPapel } from "./papel";

const usuario = (codigo: string, perfil: Papel, status?: StatusPessoa): UsuarioAutenticado => ({
    codigo,
    status,
    ...efetivasDoPapel(perfil, status),
});
const diretor = usuario("d", "diretor");
const gerente = usuario("g", "gerente");
const equipe = usuario("e", "membro");
const exEquipe = usuario("x", "membro");
const fora = usuario("f", "membro");
const trainee = usuario("t", "membro", StatusPessoa.TRAINEE);
// Criou o projeto, mas não está na equipe: `criadoPor` não dá acesso (sessão 27a).
const criador = usuario("c", "membro");
const liderDaArea = usuario("la", "membro");

const participacoes = [
    { usuario: { codigo: "e" }, ativa: true },
    { usuario: { codigo: "x" }, ativa: false },
];
const normal: ProjetoParaAcesso = { sigiloso: false, participacoes, lideresDaArea: ["la"] };
const sigiloso: ProjetoParaAcesso = { sigiloso: true, participacoes };

describe("acessoAoProjeto (sessão 27a: completo ou cartão)", () => {
    test.each([
        ["diretor", diretor, "completo"],
        ["gerente", gerente, "completo"],
        ["equipe atual", equipe, "completo"],
        ["ex-equipe (participou)", exEquipe, "completo"],
        ["líder da área (projeto geral)", liderDaArea, "completo"],
        ["membro fora", fora, "cartao"],
        ["trainee fora", trainee, "cartao"],
        ["criador fora da equipe", criador, "cartao"],
    ])("projeto normal: %s", (_nome, quem, esperado) => {
        expect(acessoAoProjeto(quem, normal)).toBe(esperado);
    });

    test.each([
        ["diretor", diretor, "completo"],
        ["equipe atual", equipe, "completo"],
        ["gerente fora", gerente, "cartao"],
        ["ex-equipe", exEquipe, "cartao"],
        ["criador fora da equipe", criador, "cartao"],
        ["membro fora", fora, "cartao"],
        ["trainee fora", trainee, "cartao"],
    ])("projeto sigiloso: %s", (_nome, quem, esperado) => {
        expect(acessoAoProjeto(quem, sigiloso)).toBe(esperado);
    });

    test("líder da área não vê completo o projeto de que não é líder da área", () => {
        expect(acessoAoProjeto(liderDaArea, { ...normal, lideresDaArea: [] })).toBe("cartao");
    });
});

describe("exigirAcessoCompleto", () => {
    function erroDe(quem: UsuarioAutenticado, projeto: ProjetoParaAcesso): ErroAplicacao {
        try {
            exigirAcessoCompleto(quem, projeto);
        } catch (e) {
            return e as ErroAplicacao;
        }
        throw new Error("Era esperado um erro.");
    }

    test.each([
        ["membro fora de projeto normal", fora, normal],
        ["membro fora de sigiloso", fora, sigiloso],
        ["gerente fora de sigiloso", gerente, sigiloso],
    ])("%s recebe 403 PROJETO_SEM_ACESSO", (_nome, quem, projeto) => {
        const erro = erroDe(quem, projeto);
        expect(erro.codigoHttp).toBe(403);
        expect(erro.codigo).toBe("PROJETO_SEM_ACESSO");
    });

    test("a mensagem diz quem vê os detalhes (gestão no normal, diretores no sigiloso)", () => {
        expect(erroDe(fora, normal).message).toMatch(/gestão/);
        expect(erroDe(fora, sigiloso).message).toMatch(/diretores/);
    });

    test("quem tem acesso completo recebe o usuário de volta", () => {
        expect(exigirAcessoCompleto(equipe, sigiloso)).toBe(equipe);
    });
});

describe("exigirNaoSeTrancar", () => {
    function erroDe(quem: UsuarioAutenticado, equipeAtual: string[]): ErroAplicacao | null {
        try {
            exigirNaoSeTrancar(quem, equipeAtual);
            return null;
        } catch (e) {
            return e as ErroAplicacao;
        }
    }

    test("gerente fora da equipe: 400 SIGILOSO_SEM_VOCE", () => {
        const erro = erroDe(gerente, ["e"]);
        expect(erro?.codigoHttp).toBe(400);
        expect(erro?.codigo).toBe("SIGILOSO_SEM_VOCE");
    });

    test("gerente na equipe passa", () => {
        expect(erroDe(gerente, ["e", "g"])).toBeNull();
    });

    test("diretor fora da equipe passa", () => {
        expect(erroDe(diretor, [])).toBeNull();
    });
});
