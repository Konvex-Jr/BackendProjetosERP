import { responderErro } from "../source/infra/http/ExpressHttp";
import { ErroNaoEncontrado } from "../source/shared/erros/ErroNaoEncontrado";

function respostaFalsa() {
    const r: any = { statusCode: 0, corpo: null };
    r.status = (s: number) => ((r.statusCode = s), r);
    r.json = (c: unknown) => ((r.corpo = c), r);
    return r;
}

describe("responderErro", () => {
    let erroConsole: jest.SpyInstance;
    beforeEach(() => (erroConsole = jest.spyOn(console, "error").mockImplementation(() => undefined)));
    afterEach(() => erroConsole.mockRestore());

    it("erro da aplicação usa o próprio status e mensagem", () => {
        const res = respostaFalsa();
        responderErro(res, new ErroNaoEncontrado("Tarefa não encontrada."));
        expect(res.statusCode).toBe(404);
        expect(res.corpo.message).toBe("Tarefa não encontrada.");
    });

    it("erro inesperado vira 500 genérico, sem expor o texto técnico", () => {
        const res = respostaFalsa();
        responderErro(res, new TypeError("Cannot read properties of undefined (reading 'x')"));
        expect(res.statusCode).toBe(500);
        expect(res.corpo.message).not.toMatch(/undefined/);
        expect(erroConsole).toHaveBeenCalled();
    });

    it("código fora do formato UUID responde 404, não 500", () => {
        const res = respostaFalsa();
        responderErro(res, { severity: "ERROR", code: "22P02", message: 'invalid input syntax for type uuid: "abc"' });
        expect(res.statusCode).toBe(404);
    });

    it("outro valor em formato inválido para o banco responde 400", () => {
        const res = respostaFalsa();
        responderErro(res, { severity: "ERROR", code: "22P02", message: 'invalid input syntax for type integer: "x"' });
        expect(res.statusCode).toBe(400);
    });

    it("demais erros do banco continuam 500 genérico", () => {
        const res = respostaFalsa();
        responderErro(res, { severity: "ERROR", code: "XX000", message: "algo interno" });
        expect(res.statusCode).toBe(500);
        expect(res.corpo.message).not.toMatch(/interno do banco|algo interno/);
    });
});
