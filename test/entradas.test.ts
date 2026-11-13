import { lerInteiro } from "../source/shared/entradas";
import { ErroValidacao } from "../source/shared/erros/ErroValidacao";

describe("lerInteiro", () => {
    it("aceita inteiros em número ou texto e trata vazio como ausente", () => {
        expect(lerInteiro(3, "ordem")).toBe(3);
        expect(lerInteiro("40", "alocacao")).toBe(40);
        expect(lerInteiro("", "ordem")).toBeUndefined();
    });

    it("recusa decimais com 400 dizendo o campo (revisão de 12/11/2026)", () => {
        expect(() => lerInteiro(1.5, "alocacao")).toThrow(ErroValidacao);
        expect(() => lerInteiro("1.5", "alocacao")).toThrow("O campo alocacao deve ser um número inteiro.");
        expect(() => lerInteiro("abc", "ordem")).toThrow("O campo ordem deve ser numérico.");
    });
});
