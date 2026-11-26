import StatusPessoa from "../source/domain/enum/StatusPessoa";
import { ErroAplicacao } from "../source/shared/erros/ErroAplicacao";
import { PADRAO_GERENTE } from "../source/shared/seguranca/catalogoPermissoes";
import { UsuarioAutenticado } from "../source/shared/seguranca/permissoes";
import {
    acessoAoProjeto,
    exigirAcessoCompleto,
    exigirNaoSeTrancar,
    ProjetoParaAcesso,
} from "../source/shared/seguranca/visibilidadeProjetos";
import { Papel, efetivasDoPapel } from "./papel";

const usuario = (codigo: string, papel: Papel, status?: StatusPessoa): UsuarioAutenticado => ({
    codigo,
    status,
    ...efetivasDoPapel(papel, status),
});
/** Gerente com cargo numa área: abre os projetos dessa área (projetos.abrirDaArea), não os das outras. */
const gerenteDe = (codigo: string, codigoArea: string): UsuarioAutenticado => ({
    codigo,
    permissoes: PADRAO_GERENTE,
    cargo: { codigo: `cargo-${codigoArea}`, nome: "Gerente", posicao: 3, codigoArea },
});

const diretor = usuario("d", "diretor");
const gerenteProjetos = gerenteDe("gp", "projetos");
const gerenteInovacao = gerenteDe("gi", "inovacao");
const equipe = usuario("e", "membro");
const exEquipe = usuario("x", "membro");
const fora = usuario("f", "membro");
const trainee = usuario("t", "membro", StatusPessoa.TRAINEE);
const liderDaArea = usuario("la", "membro");

const participacoes = [
    { usuario: { codigo: "e" }, ativa: true },
    { usuario: { codigo: "x" }, ativa: false },
];
const deProjetos: ProjetoParaAcesso = { participacoes, area: { codigo: "projetos" } };
// Inovação é subárea de Projetos: o gerente de projetos não a abre (só a própria área, sem descer).
const deInovacao: ProjetoParaAcesso = { participacoes, area: { codigo: "inovacao" } };
const semArea: ProjetoParaAcesso = { participacoes, area: null };
const geral: ProjetoParaAcesso = { participacoes: [], area: { codigo: "inovacao" }, geralDaArea: true, lideresDaArea: ["la"] };

describe("acessoAoProjeto (sessão 31a: todo projeto fechado; abre pela equipe ou pelo cargo)", () => {
    test.each([
        ["diretor (abrirTodos)", diretor, "completo"],
        ["gerente de projetos (área do cargo)", gerenteProjetos, "completo"],
        ["gerente de inovação (outra área)", gerenteInovacao, "cartao"],
        ["equipe atual", equipe, "completo"],
        ["ex-equipe (quem sai não perde o acesso)", exEquipe, "completo"],
        ["membro fora", fora, "cartao"],
        ["trainee fora", trainee, "cartao"],
    ])("projeto da área Projetos: %s", (_nome, quem, esperado) => {
        expect(acessoAoProjeto(quem, deProjetos)).toBe(esperado);
    });

    test.each([
        ["gerente de inovação", gerenteInovacao, "completo"],
        ["gerente de projetos (área acima não desce)", gerenteProjetos, "cartao"],
        ["diretor", diretor, "completo"],
    ])("projeto da Inovação: %s", (_nome, quem, esperado) => {
        expect(acessoAoProjeto(quem, deInovacao)).toBe(esperado);
    });

    test("projeto sem área: só a equipe e quem abre todos", () => {
        expect(acessoAoProjeto(gerenteProjetos, semArea)).toBe("cartao");
        expect(acessoAoProjeto(diretor, semArea)).toBe("completo");
        expect(acessoAoProjeto(exEquipe, semArea)).toBe("completo");
    });

    test("abrirDaArea sem cargo não abre nada", () => {
        const semCargo: UsuarioAutenticado = { codigo: "s", permissoes: PADRAO_GERENTE, cargo: null };
        expect(acessoAoProjeto(semCargo, deProjetos)).toBe("cartao");
    });

    test("projeto geral: todo logado vê completo; quem lidera a área também", () => {
        expect(acessoAoProjeto(fora, geral)).toBe("completo");
        expect(acessoAoProjeto(liderDaArea, geral)).toBe("completo");
    });
});

describe("exigirAcessoCompleto", () => {
    test("quem só vê o cartão recebe 403 PROJETO_SEM_ACESSO", () => {
        let erro: ErroAplicacao | undefined;
        try {
            exigirAcessoCompleto(gerenteInovacao, deProjetos);
        } catch (e) {
            erro = e as ErroAplicacao;
        }
        expect(erro?.codigoHttp).toBe(403);
        expect(erro?.codigo).toBe("PROJETO_SEM_ACESSO");
    });

    test("quem abre passa", () => {
        expect(exigirAcessoCompleto(gerenteProjetos, deProjetos)).toBe(gerenteProjetos);
    });
});

describe("exigirNaoSeTrancar (quem cria não fica de fora)", () => {
    const novo = (membros: string[], area: string | null): ProjetoParaAcesso => ({
        participacoes: membros.map((codigo) => ({ usuario: { codigo }, ativa: true })),
        area: area ? { codigo: area } : null,
    });

    test("gerente cria na área do cargo sem estar na equipe: ok", () => {
        expect(() => exigirNaoSeTrancar(gerenteProjetos, novo([], "projetos"))).not.toThrow();
    });

    test("gerente cria em outra área sem estar na equipe: 400 SEM_ACESSO_AO_CRIAR", () => {
        expect(() => exigirNaoSeTrancar(gerenteProjetos, novo([], "inovacao"))).toThrow(
            expect.objectContaining({ codigo: "SEM_ACESSO_AO_CRIAR", codigoHttp: 400 }),
        );
    });

    test("entrando na equipe ou abrindo todos: ok", () => {
        expect(() => exigirNaoSeTrancar(gerenteProjetos, novo(["gp"], null))).not.toThrow();
        expect(() => exigirNaoSeTrancar(diretor, novo([], null))).not.toThrow();
    });
});
