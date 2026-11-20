import { faltasDaSenha, validarConfirmacao, validarNovaSenha } from "../source/shared/seguranca/regraSenha";
import { ErroValidacao } from "../source/shared/erros/ErroValidacao";

describe("regra da senha", () => {
    it("lista o que falta", () => {
        expect(faltasDaSenha("abc")).toEqual(["tamanho", "maiuscula", "numero", "especial"]);
        expect(faltasDaSenha("Konvex@123")).toEqual([]);
        expect(faltasDaSenha("Konvex 123")).toEqual([]);
        expect(faltasDaSenha("KONVEX@123")).toEqual([]);
        expect(faltasDaSenha("konvex@1234")).toEqual(["maiuscula"]);
    });

    it("validarNovaSenha rejeita fraca e não string com SENHA_FRACA", () => {
        for (const ruim of [123, "abc", "konvex@1234"]) {
            try {
                validarNovaSenha(ruim);
                throw new Error("deveria lançar");
            } catch (e: any) {
                expect(e).toBeInstanceOf(ErroValidacao);
                expect(e.codigo ?? e.code).toBe("SENHA_FRACA");
            }
        }
        expect(() => validarNovaSenha("abc")).toThrow(
            "A senha precisa ter pelo menos 8 caracteres, uma letra maiúscula, um número e um caractere especial.",
        );
        expect(() => validarNovaSenha("konvex@1234")).toThrow("A senha precisa ter uma letra maiúscula.");
        expect(validarNovaSenha("Konvex@123")).toBe("Konvex@123");
    });

    it("validarConfirmacao", () => {
        expect(() => validarConfirmacao("Konvex@123", "Konvex@123")).not.toThrow();
        expect(() => validarConfirmacao("Konvex@123", "outra")).toThrow(ErroValidacao);
        expect(() => validarConfirmacao("Konvex@123", undefined)).toThrow(ErroValidacao);
    });
});
