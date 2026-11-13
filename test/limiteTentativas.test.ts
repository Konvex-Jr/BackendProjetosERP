import { LimiteTentativas } from "../source/shared/seguranca/limiteTentativas";

describe("LimiteTentativas", () => {
    let agora = 0;
    const relogio = () => agora;

    beforeEach(() => {
        agora = 1_000_000;
    });

    it("bloqueia depois do máximo de falhas dentro da janela", () => {
        const limite = new LimiteTentativas(3, 60_000, relogio);
        limite.registrarFalha("a");
        limite.registrarFalha("a");
        expect(limite.segundosBloqueado("a")).toBe(0);
        limite.registrarFalha("a");
        expect(limite.segundosBloqueado("a")).toBe(60);
        expect(limite.segundosBloqueado("b")).toBe(0);
    });

    it("libera quando a janela da primeira falha passa", () => {
        const limite = new LimiteTentativas(2, 60_000, relogio);
        limite.registrarFalha("a");
        agora += 30_000;
        limite.registrarFalha("a");
        expect(limite.segundosBloqueado("a")).toBe(30);
        agora += 30_000;
        expect(limite.segundosBloqueado("a")).toBe(0);
    });

    it("limpar zera as falhas da chave", () => {
        const limite = new LimiteTentativas(1, 60_000, relogio);
        limite.registrarFalha("a");
        limite.limpar("a");
        expect(limite.segundosBloqueado("a")).toBe(0);
    });
});
