import { diaNoFuso } from "../source/shared/datas";

describe("diaNoFuso (dia de hoje em São Paulo, à meia-noite UTC)", () => {
    it("às 22h de 13/11 em São Paulo (01h UTC de 14/11) ainda é dia 13", () => {
        expect(diaNoFuso(new Date("2026-11-14T01:00:00Z")).toISOString()).toBe("2026-11-13T00:00:00.000Z");
    });

    it("às 9h de São Paulo é o mesmo dia", () => {
        expect(diaNoFuso(new Date("2026-11-13T12:00:00Z")).toISOString()).toBe("2026-11-13T00:00:00.000Z");
    });

    it("virada do ano", () => {
        expect(diaNoFuso(new Date("2027-01-01T02:59:00Z")).toISOString()).toBe("2026-12-31T00:00:00.000Z");
        expect(diaNoFuso(new Date("2027-01-01T03:00:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
    });
});
