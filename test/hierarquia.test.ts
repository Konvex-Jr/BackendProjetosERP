import Cargo from "../source/domain/entity/Cargo";
import { PADRAO_GERENTE, PADRAO_MEMBRO, Permissao } from "../source/shared/seguranca/catalogoPermissoes";
import {
    exigirAlterarCargo,
    exigirConceder,
    exigirDarCargo,
    exigirGerirPessoa,
    exigirPosicaoAbaixo,
} from "../source/shared/seguranca/hierarquia";
import { UsuarioAutenticado } from "../source/shared/seguranca/permissoes";
import { efetivasDoPapel } from "./papel";

const pessoa = (codigo: string, papel: "presidente" | "diretor" | "gerente"): UsuarioAutenticado => ({ codigo, ...efetivasDoPapel(papel) });
const presidente = pessoa("pres", "presidente");
const diretor = pessoa("dir", "diretor");
const gerente = pessoa("ger", "gerente");
const cargo = (posicao: number, nome = `Cargo ${posicao}`) => new Cargo(nome, true, `c-${nome}`, false, 10, posicao, PADRAO_MEMBRO);

describe("hierarquia (sessão 31a)", () => {
    describe("exigirAlterarCargo", () => {
        test("gerente (3) não altera cargo de posição 3 (nem o próprio nível): 403 SO_ABAIXO", () => {
            expect(() => exigirAlterarCargo(gerente, cargo(3))).toThrow(expect.objectContaining({ codigoHttp: 403 }));
            expect(() => exigirAlterarCargo(gerente, cargo(3))).toThrow("Você só altera cargos abaixo do seu.");
        });
        test("gerente altera posição 4; diretor não altera outro diretor; presidente altera diretor", () => {
            expect(() => exigirAlterarCargo(gerente, cargo(4))).not.toThrow();
            expect(() => exigirAlterarCargo(diretor, cargo(2))).toThrow(expect.objectContaining({ codigoHttp: 403 }));
            expect(() => exigirAlterarCargo(presidente, cargo(2))).not.toThrow();
        });
        test("o cargo do presidente não é alterado por ninguém (sempre pode tudo)", () => {
            expect(() => exigirAlterarCargo(presidente, cargo(1))).toThrow(expect.objectContaining({ codigoHttp: 403 }));
        });
    });

    describe("exigirConceder", () => {
        const semClientes: UsuarioAutenticado = { codigo: "g2", permissoes: PADRAO_GERENTE, cargo: gerente.cargo };
        test("gerente sem clientes.ver não liga clientes.ver: 403 com o nome da permissão", () => {
            expect(() => exigirConceder(semClientes, [], [Permissao.CLIENTES_VER])).toThrow(/Vê dados do cliente e contratos/);
        });
        test("desligar uma que não tem e manter as que já estavam: ok", () => {
            expect(() => exigirConceder(semClientes, [Permissao.CLIENTES_VER], [])).not.toThrow();
            expect(() => exigirConceder(semClientes, [Permissao.CLIENTES_VER], [Permissao.CLIENTES_VER])).not.toThrow();
        });
    });

    describe("exigirDarCargo e exigirGerirPessoa", () => {
        test("gerente dá cargo de posição 4, não de 3", () => {
            expect(() => exigirDarCargo(gerente, cargo(4))).not.toThrow();
            expect(() => exigirDarCargo(gerente, cargo(3))).toThrow(expect.objectContaining({ codigoHttp: 403 }));
            expect(() => exigirDarCargo(gerente, null)).not.toThrow();
        });
        test("gerente não gere pessoa de posição 2; gere quem não tem cargo; ninguém gere a si (menos o presidente)", () => {
            expect(() => exigirGerirPessoa(gerente, { codigo: "x", cargo: { posicao: 2 } })).toThrow(
                expect.objectContaining({ codigoHttp: 403 }),
            );
            expect(exigirGerirPessoa(gerente, { codigo: "x", cargo: null })).toBe(gerente);
            expect(() => exigirGerirPessoa(gerente, { codigo: "ger", cargo: { posicao: 3 } })).toThrow(/próprios períodos/);
            expect(exigirGerirPessoa(presidente, { codigo: "pres", cargo: { posicao: 1 } })).toBe(presidente);
        });
    });

    describe("exigirPosicaoAbaixo", () => {
        test("gerente cria cargo de posição 4, não de 3; ninguém cria posição 1", () => {
            expect(() => exigirPosicaoAbaixo(gerente, 4)).not.toThrow();
            expect(() => exigirPosicaoAbaixo(gerente, 3)).toThrow(expect.objectContaining({ codigoHttp: 403 }));
            expect(() => exigirPosicaoAbaixo(presidente, 1)).toThrow(expect.objectContaining({ codigoHttp: 403 }));
            expect(() => exigirPosicaoAbaixo(presidente, 2)).not.toThrow();
        });
    });
});
