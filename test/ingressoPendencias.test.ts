import Usuario from "../source/domain/entity/Usuario";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import { conferirCamposAlterados, ingressoValido, pendenciasPerfil } from "../source/useCases/pessoas/dadosPessoa";
import { hoje } from "../source/shared/datas";
import Router from "../source/infra/http/Router";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";
import { cadastrarComSenha, criarContexto } from "./fixtures";
import { autenticado, comPapel } from "./papel";

const completo = {
    curso: "Ciência da Computação",
    telefone: "(11) 98765-4321",
    emailPessoal: "a@b.com",
    ingresso: "2025/1",
    calendarioUrl: "https://cal.exemplo.com/a",
};
const pessoa = (detalhes: any = {}) => comPapel(new Usuario("Ana", "ana@x.com", true, "h", null, undefined, detalhes), "diretor");

describe("ingresso", () => {
    test.each(["2025/1", "2025/2", "2000/1"])("%s é aceito", (v) => {
        expect(() => conferirCamposAlterados(pessoa(completo), { ingresso: v })).not.toThrow();
    });
    test.each(["2025/3", "25/1", "1999/2", "2025-1", "2025/0", "abc"])("%s é recusado", (v) => {
        expect(() => conferirCamposAlterados(pessoa(completo), { ingresso: v })).toThrow(
            expect.objectContaining({ codigo: "INGRESSO_INVALIDO" }),
        );
    });
    test("semestre futuro é recusado e o atual passa", () => {
        const h = hoje();
        const ano = h.getUTCFullYear();
        const sem = h.getUTCMonth() < 6 ? 1 : 2;
        expect(() => conferirCamposAlterados(pessoa(completo), { ingresso: `${ano}/${sem}` })).not.toThrow();
        const futuro = sem === 1 ? `${ano}/2` : `${ano + 1}/1`;
        expect(() => conferirCamposAlterados(pessoa(completo), { ingresso: futuro })).toThrow(
            expect.objectContaining({ codigo: "INGRESSO_INVALIDO" }),
        );
    });
    test("ingresso antigo inválido é mantido ao editar outro campo", () => {
        const antiga = pessoa({ ...completo, ingresso: "1990/9" });
        expect(() => conferirCamposAlterados(antiga, { bio: "oi" })).not.toThrow();
        expect(() => conferirCamposAlterados(antiga, { ingresso: "1990/9" })).not.toThrow();
    });
});

describe("ingressoValido na virada do semestre", () => {
    const em = (d: string) => new Date(`${d}T00:00:00.000Z`);
    test("30/06, 01/07 e 31/12", () => {
        expect(ingressoValido("2026/2", em("2026-06-30"))).toBe(false);
        expect(ingressoValido("2026/1", em("2026-06-30"))).toBe(true);
        expect(ingressoValido("2026/2", em("2026-07-01"))).toBe(true);
        expect(ingressoValido("2027/1", em("2026-12-31"))).toBe(false);
        expect(ingressoValido("2026/2", em("2026-12-31"))).toBe(true);
    });
});

describe("pendenciasPerfil", () => {
    test("pessoa completa não tem pendência", () => expect(pendenciasPerfil(pessoa(completo))).toEqual([]));
    test("devolve os faltantes na ordem", () => {
        expect(pendenciasPerfil(pessoa({}))).toEqual(["curso", "telefone", "emailPessoal", "ingresso", "calendarioUrl"]);
        expect(pendenciasPerfil(pessoa({ ...completo, telefone: null, ingresso: null }))).toEqual(["telefone", "ingresso"]);
    });
    test("curso fora da lista, telefone fora da regra e ingresso inválido contam", () => {
        const p = pessoa({ ...completo, curso: "Direito", telefone: "123", ingresso: "1990/9" });
        expect(pendenciasPerfil(p)).toEqual(["curso", "telefone", "ingresso"]);
    });
    test("inativo devolve vazio", () => {
        expect(pendenciasPerfil(pessoa({ status: StatusPessoa.INATIVO }))).toEqual([]);
    });
});

describe("rotas devolvem pendenciasPerfil", () => {
    async function rotas() {
        const { factory, membro } = await criarContexto();
        const r: Record<string, any> = {};
        new Router(
            { route: (m: string, u: string, _a: boolean, cb: any) => (r[`${m} ${u}`] = cb), swagger: () => undefined } as any,
            factory,
        ).init();
        return { r, eu: autenticado(membro), membro, factory };
    }
    test("GET /auth/me e PUT /auth/perfil", async () => {
        const { r, eu } = await rotas();
        const me = await r["get /auth/me"]({}, { user: eu });
        expect(Array.isArray(me.pendenciasPerfil)).toBe(true);
        expect(me.pendenciasPerfil).toContain("ingresso");
        const antes = me.pendenciasPerfil;
        const ed = await r["put /auth/perfil"]({}, { user: eu, ingresso: "2025/1" });
        expect(ed.ingresso).toBe("2025/1");
        expect(ed.pendenciasPerfil).toEqual(antes.filter((c: string) => c !== "ingresso"));
        await expect(r["put /auth/perfil"]({}, { user: eu, ingresso: "2025/3" })).rejects.toMatchObject({ codigo: "INGRESSO_INVALIDO" });
    });
    test("diretor sem senioridade completa o perfil por PUT /auth/perfil", async () => {
        const { r, factory } = await rotas();
        const dir = await factory.criarUsuarioRepository().criar(comPapel(new Usuario("Dir", "dir@x.com", true, "h"), "diretor"));
        const ed = await r["put /auth/perfil"](
            {},
            {
                user: autenticado(dir!),
                ...completo,
            },
        );
        expect(ed.pendenciasPerfil).toEqual([]);
    });
    test("login traz pendenciasPerfil no usuario", async () => {
        const { r, factory } = await rotas();
        const ana = await cadastrarComSenha(
            factory,
            {
                nome: "Zé",
                email: "ze@x.com",
                senioridade: new SenioridadeUsuario("pleno", "Pleno", 75),
                curso: "Engenharia Mecânica",
            } as any,
            "Konvex@123",
        );
        const out = await r["post /auth/login"]({}, { email: ana.email, senha: "Konvex@123" }, {}, {});
        const usuario = JSON.parse(JSON.stringify(out.corpo)).usuario;
        expect(usuario.pendenciasPerfil).toEqual(["telefone", "emailPessoal", "ingresso", "calendarioUrl"]);
    });
});
