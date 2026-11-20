import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea, { sobrepoe, validarNovoPeriodo } from "../source/domain/entity/PeriodoArea";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import SalvarCargo from "../source/useCases/config/SalvarCargo";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import { hoje } from "../source/shared/datas";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const aMais = (dias: number) => new Date(hoje().getTime() + dias * 86_400_000);

const ativa = new Area("Projetos");
const outra = new Area("Marketing");
const ativo = { status: StatusPessoa.ATIVO, dataSaida: null };
const alumni = { status: StatusPessoa.INATIVO, dataSaida: dia("2026-06-01") };

function periodo(area: Area, inicio: string, fim: string | null, cargo: Cargo | null = null, codigo?: string) {
    return new PeriodoArea("u1", area, cargo, dia(inicio), fim ? dia(fim) : null, null, codigo);
}

function codigoDoErro(fn: () => void): string | undefined {
    try {
        fn();
    } catch (e: any) {
        return e.codigo;
    }
    return undefined;
}

describe("PeriodoArea", () => {
    it("recusa início no futuro", () => {
        expect(codigoDoErro(() => new PeriodoArea("u1", ativa, null, aMais(1), null, null))).toBe("INICIO_NO_FUTURO");
    });
    it("recusa fim no futuro", () => {
        expect(codigoDoErro(() => new PeriodoArea("u1", ativa, null, dia("2026-01-01"), aMais(1), null))).toBe("FIM_NO_FUTURO");
    });
    it("recusa fim igual ao início", () => {
        expect(codigoDoErro(() => periodo(ativa, "2026-03-01", "2026-03-01"))).toBe("FIM_NAO_DEPOIS_DO_INICIO");
    });
    it("aberto e copiar", () => {
        const p = periodo(ativa, "2026-03-01", null);
        expect(p.aberto).toBe(true);
        const c = p.copiar({ fim: dia("2026-04-01") });
        expect(c.aberto).toBe(false);
        expect(c.codigo).toBe(p.codigo);
    });
});

describe("sobrepoe (semiaberto, nulo = infinito)", () => {
    const a = { inicio: dia("2026-03-01"), fim: dia("2026-06-01") };
    it("troca no mesmo dia não sobrepõe", () => {
        expect(sobrepoe(a, { inicio: dia("2026-06-01"), fim: null })).toBe(false);
    });
    it("contido sobrepõe", () => {
        expect(sobrepoe(a, { inicio: dia("2026-05-15"), fim: dia("2026-05-20") })).toBe(true);
    });
    it("fechado que termina antes do outro começar não sobrepõe", () => {
        expect(sobrepoe({ inicio: dia("2026-01-01"), fim: dia("2026-02-01") }, { inicio: dia("2026-03-01"), fim: dia("2026-04-01") })).toBe(
            false,
        );
    });
    it("aberto contra fechado que começa depois sobrepõe", () => {
        expect(sobrepoe({ inicio: dia("2026-01-01"), fim: null }, { inicio: dia("2026-03-01"), fim: dia("2026-04-01") })).toBe(true);
    });
    it("aberto com aberto sobrepõe", () => {
        expect(sobrepoe({ inicio: dia("2026-01-01"), fim: null }, { inicio: dia("2026-02-01"), fim: null })).toBe(true);
    });
});

describe("validarNovoPeriodo", () => {
    it("sobreposto na mesma área", () => {
        const outroPeriodo = periodo(ativa, "2026-01-01", null);
        expect(codigoDoErro(() => validarNovoPeriodo(periodo(ativa, "2026-03-01", null), [outroPeriodo], null, ativo))).toBe(
            "PERIODO_SOBREPOSTO",
        );
    });
    it("área diferente é ok", () => {
        const outroPeriodo = periodo(outra, "2026-01-01", null);
        expect(() => validarNovoPeriodo(periodo(ativa, "2026-03-01", null), [outroPeriodo], null, ativo)).not.toThrow();
    });
    it("editar sem mudar datas ignora o próprio", () => {
        const p = periodo(ativa, "2026-03-01", null, null, "p1");
        expect(() => validarNovoPeriodo(p, [p], p, ativo)).not.toThrow();
    });
    it("área inativa nova", () => {
        const inativa = new Area("Velha", null, false);
        expect(codigoDoErro(() => validarNovoPeriodo(periodo(inativa, "2026-03-01", null), [], null, ativo))).toBe("AREA_INATIVA");
    });
    it("mesma área inativa do anterior, mudando só o fim, é ok", () => {
        const inativa = new Area("Velha", null, false);
        const anterior = periodo(inativa, "2026-03-01", null, null, "p1");
        const novo = anterior.copiar({ fim: dia("2026-04-01") });
        expect(() => validarNovoPeriodo(novo, [anterior], anterior, ativo)).not.toThrow();
    });
    it("cargo inativo novo", () => {
        const cargo = new Cargo("Velho", false);
        expect(codigoDoErro(() => validarNovoPeriodo(periodo(ativa, "2026-03-01", null, cargo), [], null, ativo))).toBe("CARGO_INATIVO");
    });
    it("aberto com pessoa alumni", () => {
        expect(codigoDoErro(() => validarNovoPeriodo(periodo(ativa, "2026-03-01", null), [], null, alumni))).toBe("PESSOA_FORA_DA_EJ");
    });
    it("fechado com fim depois da saída", () => {
        expect(codigoDoErro(() => validarNovoPeriodo(periodo(ativa, "2026-03-01", "2026-07-01"), [], null, alumni))).toBe(
            "FIM_DEPOIS_DA_SAIDA",
        );
    });
    it("fechado antes da saída, para alumni, é ok", () => {
        expect(() => validarNovoPeriodo(periodo(ativa, "2026-03-01", "2026-05-01"), [], null, alumni)).not.toThrow();
    });
});

describe("validarNovoPeriodo: um cargo por vez", () => {
    const diretor = new Cargo("Diretor");
    const assessor = new Cargo("Assessor");

    it("cargo sobreposto a outro cargo em outra área: 400 citando a área", () => {
        const outro = periodo(outra, "2026-01-01", null, diretor);
        let erro: any;
        try {
            validarNovoPeriodo(periodo(ativa, "2026-03-01", null, assessor), [outro], null, ativo);
        } catch (e) {
            erro = e;
        }
        expect(erro.codigo).toBe("PERIODO_CARGO_SIMULTANEO");
        expect(erro.message).toContain("Marketing");
    });
    it("cargo sobreposto a outro sem cargo é ok", () => {
        const outro = periodo(outra, "2026-01-01", null);
        expect(() => validarNovoPeriodo(periodo(ativa, "2026-03-01", null, assessor), [outro], null, ativo)).not.toThrow();
    });
    it("dois sem cargo é ok", () => {
        const outro = periodo(outra, "2026-01-01", null);
        expect(() => validarNovoPeriodo(periodo(ativa, "2026-03-01", null), [outro], null, ativo)).not.toThrow();
    });
    it("cargo com datas que não se tocam é ok", () => {
        const outro = periodo(outra, "2026-01-01", "2026-03-01", diretor);
        expect(() => validarNovoPeriodo(periodo(ativa, "2026-03-01", null, assessor), [outro], null, ativo)).not.toThrow();
    });

    describe("dados antigos com dois cargos sobrepostos", () => {
        const velho = PeriodoArea.carregar("u1", ativa, assessor, dia("2026-02-01"), null, null, "p1");
        const outro = PeriodoArea.carregar("u1", outra, diretor, dia("2026-01-01"), null, null, "p2");
        it("encurtar o fim é ok", () => {
            expect(() => validarNovoPeriodo(velho.copiar({ fim: dia("2026-05-01") }), [outro], velho, ativo)).not.toThrow();
        });
        it("trocar o cargo barra", () => {
            const outroCargo = new Cargo("Gerente");
            expect(codigoDoErro(() => validarNovoPeriodo(velho.copiar({ cargo: outroCargo }), [outro], velho, ativo))).toBe(
                "PERIODO_CARGO_SIMULTANEO",
            );
        });
        it("adiantar o início barra", () => {
            expect(codigoDoErro(() => validarNovoPeriodo(velho.copiar({ inicio: dia("2026-01-15") }), [outro], velho, ativo))).toBe(
                "PERIODO_CARGO_SIMULTANEO",
            );
        });
        it("esticar o fim barra", () => {
            const fechado = PeriodoArea.carregar("u1", ativa, assessor, dia("2026-02-01"), dia("2026-04-01"), null, "p1");
            expect(codigoDoErro(() => validarNovoPeriodo(fechado.copiar({ fim: dia("2026-05-01") }), [outro], fechado, ativo))).toBe(
                "PERIODO_CARGO_SIMULTANEO",
            );
        });
        it("abrir um período fechado barra", () => {
            const fechado = PeriodoArea.carregar("u1", ativa, assessor, dia("2026-02-01"), dia("2026-04-01"), null, "p1");
            expect(codigoDoErro(() => validarNovoPeriodo(fechado.copiar({ fim: null }), [outro], fechado, ativo))).toBe(
                "PERIODO_CARGO_SIMULTANEO",
            );
        });
        it("mover para sobrepor um período que antes não sobrepunha barra", () => {
            const antes = PeriodoArea.carregar("u1", ativa, assessor, dia("2025-01-01"), dia("2025-06-01"), null, "p1");
            expect(codigoDoErro(() => validarNovoPeriodo(antes.copiar({ fim: dia("2026-02-01") }), [outro], antes, ativo))).toBe(
                "PERIODO_CARGO_SIMULTANEO",
            );
        });
    });
});

describe("Cargo.lideraArea", () => {
    it("padrão false", () => expect(new Cargo("Diretor").lideraArea).toBe(false));
    it("true quando passado", () => expect(new Cargo("Diretor", true, undefined, true).lideraArea).toBe(true));
});

describe("SalvarCargo e lideraArea", () => {
    it("criar grava lideraArea e a memória guarda", async () => {
        const factory = new MemoryRepositoryFactory();
        const criado = await new SalvarCargo(factory).execute({ nome: "Líder", lideraArea: true });
        expect((await factory.criarCargoRepository().buscarPorCodigo(criado.codigo))?.lideraArea).toBe(true);
    });
    it("editar sem lideraArea mantém o valor atual", async () => {
        const factory = new MemoryRepositoryFactory();
        const criado = await new SalvarCargo(factory).execute({ nome: "Líder", lideraArea: true });
        const editado = await new SalvarCargo(factory).execute({ codigo: criado.codigo, nome: "Líder 2" });
        expect(editado.lideraArea).toBe(true);
        expect((await factory.criarCargoRepository().buscarPorCodigo(criado.codigo))?.lideraArea).toBe(true);
    });
    it("editar com lideraArea false desliga", async () => {
        const factory = new MemoryRepositoryFactory();
        const criado = await new SalvarCargo(factory).execute({ nome: "Líder", lideraArea: true });
        const editado = await new SalvarCargo(factory).execute({ codigo: criado.codigo, nome: "Líder", lideraArea: false });
        expect(editado.lideraArea).toBe(false);
    });
});
