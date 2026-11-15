import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { apagarSemRegistro, conferirAnexos, relatorioConferencia, TABELA_DO_DONO } from "../source/infra/arquivos/conferenciaAnexos";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";
const reg = (arquivo: string, donoCodigo = "d1") => ({
    codigo: `c-${arquivo}`,
    donoTipo: "biblioteca",
    donoCodigo,
    nome: "x.pdf",
    arquivo,
});

describe("conferência de anexos órfãos", () => {
    it("só os donos atuais: Biblioteca e capacitação (sessão 17)", () => {
        expect(TABELA_DO_DONO).toEqual({ biblioteca: "biblioteca_itens", capacitacao: "capacitacoes" });
    });

    it("não acusa nada quando banco, disco e donos batem", () => {
        const r = conferirAnexos([reg(A)], [A], new Set(["biblioteca:d1"]));
        expect([r.semArquivo, r.semDono, r.semRegistro]).toEqual([[], [], []]);
        expect(relatorioConferencia(r)).toContain("Tudo certo");
    });

    it("acha registro sem arquivo, arquivo sem registro e anexo sem dono", () => {
        const r = conferirAnexos([reg(A), reg(B, "apagado")], [B, C, "LEIA.txt"], new Set(["biblioteca:d1"]));
        expect(r.semArquivo.map((x) => x.arquivo)).toEqual([A]);
        expect(r.semDono.map((x) => x.arquivo)).toEqual([B]);
        expect(r.semRegistro).toEqual([C]);
        expect(relatorioConferencia(r)).toContain("Nada foi apagado");
    });
});

describe("apagar arquivos sem registro (--apagar-sem-registro)", () => {
    let pasta: string;
    beforeEach(() => {
        pasta = mkdtempSync(path.join(tmpdir(), "anexos-"));
    });
    afterEach(() => rmSync(pasta, { recursive: true, force: true }));

    it("apaga só os arquivos pedidos com nome de anexo e diz quantos", async () => {
        for (const nome of [A, B, C, "LEIA.txt"]) writeFileSync(path.join(pasta, nome), "x");
        const apagados = await apagarSemRegistro(pasta, [A, C]);
        expect(apagados).toBe(2);
        expect(readdirSync(pasta).sort()).toEqual([B, "LEIA.txt"]);
    });

    it("ignora nome fora do padrão (nada fora da pasta dos anexos) e arquivo que já sumiu", async () => {
        writeFileSync(path.join(pasta, "LEIA.txt"), "x");
        const apagados = await apagarSemRegistro(pasta, ["LEIA.txt", `../${A}`, "../../etc/passwd", A]);
        expect(apagados).toBe(0);
        expect(readdirSync(pasta)).toEqual(["LEIA.txt"]);
    });
});
