import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "fs";
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
    const ONZE_MINUTOS_ATRAS = new Date(Date.now() - 11 * 60 * 1000);
    /** Cria o arquivo com mtime antigo (fora da janela de upload em andamento). */
    const antigo = (nome: string) => {
        writeFileSync(path.join(pasta, nome), "x");
        utimesSync(path.join(pasta, nome), ONZE_MINUTOS_ATRAS, ONZE_MINUTOS_ATRAS);
    };
    beforeEach(() => {
        pasta = mkdtempSync(path.join(tmpdir(), "anexos-"));
    });
    afterEach(() => rmSync(pasta, { recursive: true, force: true }));

    it("apaga só os arquivos pedidos com nome de anexo e diz quantos", async () => {
        for (const nome of [A, B, C, "LEIA.txt"]) antigo(nome);
        const r = await apagarSemRegistro(pasta, [A, C]);
        expect(r).toEqual({ apagados: 2, jaSumiram: 0, recentes: [] });
        expect(readdirSync(pasta).sort()).toEqual([B, "LEIA.txt"]);
    });

    it("não apaga arquivo modificado nos últimos 10 minutos (upload em andamento); o antigo sai", async () => {
        writeFileSync(path.join(pasta, A), "recente"); // mtime = agora
        antigo(B);
        const r = await apagarSemRegistro(pasta, [A, B]);
        expect(r).toEqual({ apagados: 1, jaSumiram: 0, recentes: [A] });
        expect(readdirSync(pasta)).toEqual([A]);
    });

    it("ignora nome fora do padrão (nada fora da pasta dos anexos); arquivo que já sumiu conta à parte", async () => {
        antigo("LEIA.txt");
        const r = await apagarSemRegistro(pasta, ["LEIA.txt", `../${A}`, "../../etc/passwd", A]);
        expect(r).toEqual({ apagados: 0, jaSumiram: 1, recentes: [] });
        expect(readdirSync(pasta)).toEqual(["LEIA.txt"]);
    });
});
