import ItemBiblioteca from "../source/domain/entity/ItemBiblioteca";
import SigiloBiblioteca from "../source/domain/enum/SigiloBiblioteca";
import { ErroValidacao } from "../source/shared/erros/ErroValidacao";

describe("ItemBiblioteca", () => {
    it("sem sigilo vira todos", () => {
        expect(new ItemBiblioteca({ titulo: "Guia" }).sigilo).toBe(SigiloBiblioteca.TODOS);
    });

    it("sigilo projeto sem projeto lança ErroValidacao", () => {
        expect(() => new ItemBiblioteca({ titulo: "Guia", sigilo: "projeto" })).toThrow(ErroValidacao);
        expect(new ItemBiblioteca({ titulo: "Guia", sigilo: "projeto", projeto: { codigo: "p1", nome: "P1" } }).sigilo).toBe("projeto");
    });

    it("título vazio ou com 161 caracteres lança", () => {
        expect(() => new ItemBiblioteca({ titulo: "   " })).toThrow(ErroValidacao);
        expect(() => new ItemBiblioteca({ titulo: "a".repeat(161) })).toThrow(ErroValidacao);
        expect(new ItemBiblioteca({ titulo: "a".repeat(160) }).titulo).toHaveLength(160);
    });

    it("link ftp:// lança; https:// passa", () => {
        expect(() => new ItemBiblioteca({ titulo: "Guia", links: ["ftp://x.com/a"] })).toThrow(ErroValidacao);
        expect(new ItemBiblioteca({ titulo: "Guia", links: ["https://x.com/a"] }).links).toEqual(["https://x.com/a"]);
    });

    it("tags ['Mercado','#delivery','mercado'] viram ['mercado','delivery']", () => {
        expect(new ItemBiblioteca({ titulo: "Guia", tags: ["Mercado", "#delivery", "mercado"] }).tags).toEqual(["mercado", "delivery"]);
    });

    it("sigilo desconhecido lança", () => {
        expect(() => new ItemBiblioteca({ titulo: "Guia", sigilo: "secreto" })).toThrow(ErroValidacao);
    });
});
