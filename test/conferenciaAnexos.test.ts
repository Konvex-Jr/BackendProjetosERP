import { conferirAnexos, relatorioConferencia } from "../source/infra/arquivos/conferenciaAnexos";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";
const reg = (arquivo: string, donoCodigo = "d1") => ({
    codigo: `c-${arquivo}`,
    donoTipo: "conhecimento",
    donoCodigo,
    nome: "x.pdf",
    arquivo,
});

describe("conferência de anexos órfãos", () => {
    it("não acusa nada quando banco, disco e donos batem", () => {
        const r = conferirAnexos([reg(A)], [A], new Set(["conhecimento:d1"]));
        expect([r.semArquivo, r.semDono, r.semRegistro]).toEqual([[], [], []]);
        expect(relatorioConferencia(r)).toContain("Tudo certo");
    });

    it("acha registro sem arquivo, arquivo sem registro e anexo sem dono", () => {
        const r = conferirAnexos([reg(A), reg(B, "apagado")], [B, C, "LEIA.txt"], new Set(["conhecimento:d1"]));
        expect(r.semArquivo.map((x) => x.arquivo)).toEqual([A]);
        expect(r.semDono.map((x) => x.arquivo)).toEqual([B]);
        expect(r.semRegistro).toEqual([C]);
        expect(relatorioConferencia(r)).toContain("Nada foi apagado");
    });
});
