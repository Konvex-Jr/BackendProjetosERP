import Usuario, { DetalhesPessoa } from "../source/domain/entity/Usuario";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import { ehCursoValido } from "../source/domain/enum/Curso";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";

const senioridade = new SenioridadeUsuario("sen-1", "Pleno", 10);
const criar = (d: DetalhesPessoa = {}) =>
    new Usuario("Ana", "ana@konvex.com.br", PerfilUsuario.MEMBRO, true, "hash", senioridade, "usr-ana", d);
const codigo = (f: () => unknown) => {
    try {
        f();
    } catch (e: any) {
        return e.codigo ?? e.code;
    }
    return null;
};

describe("campos novos da pessoa (25b)", () => {
    it("normaliza o e-mail pessoal", () => {
        expect(criar({ emailPessoal: "  Ana@Gmail.com " }).emailPessoal).toBe("ana@gmail.com");
    });
    it("rejeita e-mail pessoal inválido ou longo", () => {
        expect(codigo(() => criar({ emailPessoal: "ana@" }))).toBe("EMAIL_PESSOAL_INVALIDO");
        expect(codigo(() => criar({ emailPessoal: "a".repeat(245) + "@gmail.com" }))).toBe("EMAIL_PESSOAL_INVALIDO");
    });
    it("limita o motivo da saída a 500", () => {
        expect(codigo(() => criar({ motivoSaida: "x".repeat(501) }))).toBe("MOTIVO_SAIDA_LONGO");
        expect(criar({ motivoSaida: "x".repeat(500) }).motivoSaida).toHaveLength(500);
    });
    it("rejeita fimTrainee inválido", () => {
        expect(codigo(() => criar({ fimTrainee: new Date("x") }))).toBe("DATA_PESSOA_INVALIDA");
    });
    it("toJSON traz os campos", () => {
        const json = criar({ emailPessoal: "a@b.co", motivoSaida: "m", fimTrainee: new Date("2026-01-01") }).toJSON();
        expect(json).toMatchObject({ emailPessoal: "a@b.co", motivoSaida: "m" });
        expect(json.fimTrainee).toBeInstanceOf(Date);
    });
    it("status sem Alumni; cursos", () => {
        expect(Object.values(StatusPessoa)).toEqual(["ativo", "trainee", "inativo"]);
        expect(ehCursoValido("Engenharia Elétrica")).toBe(true);
        expect(ehCursoValido("Análise e Desenvolvimento de Sistemas")).toBe(true);
        expect(ehCursoValido("Eng. de Software")).toBe(false);
    });
});
