import Area from "../../source/domain/entity/Area";
import Cargo from "../../source/domain/entity/Cargo";
import Usuario from "../../source/domain/entity/Usuario";
import { hoje } from "../../source/shared/datas";
import { criarContexto } from "../fixtures";
import { subirServidor } from "./servidorTeste";
import { comPapel, darCargo } from "../papel";

/** Sessão 23a: períodos por área no perfil; a gestão lança e corrige, todos os logados leem. */
describe("Períodos por área (HTTP)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let area: Area;
    let cargo: Cargo;
    let diretora: Usuario;

    beforeEach(async () => {
        ctx = await criarContexto();
        area = await ctx.factory.criarAreaRepository().criar(new Area("Projetos"));
        cargo = await ctx.factory.criarCargoRepository().criar(new Cargo("Assessor"));
        diretora = comPapel(new Usuario("Clara", "clara@konvex.com.br", true, "x", ctx.senioridade, "usr-clara"), "diretor");
        await ctx.factory.criarUsuarioRepository().criar(diretora);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const caminho = (u: Usuario) => `/usuarios/${u.codigo}/periodos`;
    const corpo = (extra: Record<string, unknown> = {}) => ({
        codigoArea: area.codigo,
        codigoCargo: cargo.codigo,
        inicio: "2026-02-01",
        ...extra,
    });

    it("sem login: 401; membro: 403 ao gravar, mas lê", async () => {
        expect((await servidor.chamar("post", caminho(ctx.membro), { corpo: corpo() })).status).toBe(401);
        expect((await servidor.chamar("post", caminho(ctx.membro), { usuario: ctx.membro, corpo: corpo() })).status).toBe(403);
        const lista = await servidor.chamar("get", caminho(ctx.gerente), { usuario: ctx.membro });
        expect(lista.status).toBe(200);
        expect(lista.corpo).toEqual([]);
    });

    it("gerente cria, edita e exclui; a pessoa passa a ter a área atual", async () => {
        const criado = await servidor.chamar("post", caminho(ctx.membro), { usuario: ctx.gerente, corpo: corpo() });
        expect(criado.status).toBe(200);
        expect(criado.corpo).toMatchObject({ area: { nome: "Projetos" }, cargo: { nome: "Assessor" }, fim: null });

        const pessoa = await servidor.chamar("get", `/usuarios/${ctx.membro.codigo}`, { usuario: ctx.membro });
        expect(pessoa.corpo.areas.map((a: any) => a.area.nome)).toEqual(["Projetos"]);

        const editado = await servidor.chamar("put", `${caminho(ctx.membro)}/${criado.corpo.codigo}`, {
            usuario: ctx.gerente,
            corpo: corpo({ inicio: "2026-01-10", fim: "2026-03-01", codigoCargo: null }),
        });
        expect(editado.status).toBe(200);
        expect(editado.corpo).toMatchObject({ cargo: null, fim: "2026-03-01T00:00:00.000Z" });

        const excluido = await servidor.chamar("delete", `${caminho(ctx.membro)}/${criado.corpo.codigo}`, { usuario: ctx.gerente });
        expect(excluido.status).toBe(204);
        expect((await servidor.chamar("get", caminho(ctx.membro), { usuario: ctx.gerente })).corpo).toEqual([]);
    });

    it("data futura: 400 INICIO_NO_FUTURO; início faltando: 400", async () => {
        const amanha = new Date(hoje().getTime() + 86_400_000).toISOString().slice(0, 10);
        const futura = await servidor.chamar("post", caminho(ctx.membro), { usuario: ctx.gerente, corpo: corpo({ inicio: amanha }) });
        expect(futura.status).toBe(400);
        expect(futura.corpo.codigo).toBe("INICIO_NO_FUTURO");
        const semInicio = await servidor.chamar("post", caminho(ctx.membro), { usuario: ctx.gerente, corpo: corpo({ inicio: undefined }) });
        expect(semInicio.status).toBe(400);
    });

    it("sem área: 400 CAMPO_OBRIGATORIO, não 404", async () => {
        for (const codigoArea of [undefined, null, ""]) {
            const r = await servidor.chamar("post", caminho(ctx.membro), { usuario: ctx.gerente, corpo: corpo({ codigoArea }) });
            expect(r.status).toBe(400);
            expect(r.corpo.codigo).toBe("CAMPO_OBRIGATORIO");
        }
    });

    it("gerente não mexe nos períodos de um diretor; diretor não mexe nos próprios: 403", async () => {
        await darCargo(ctx.factory, diretora, "diretor");
        const r = await servidor.chamar("post", caminho(diretora), { usuario: ctx.gerente, corpo: corpo() });
        expect(r.status).toBe(403);
        expect((await servidor.chamar("post", caminho(diretora), { usuario: diretora, corpo: corpo() })).status).toBe(403);
    });

    it("tela antiga mandando codigoArea e codigoCargo no PUT da pessoa: 200 e campos ignorados", async () => {
        const r = await servidor.chamar("put", `/usuarios/${ctx.membro.codigo}`, {
            usuario: ctx.gerente,
            corpo: { nome: "Ana S.", codigoArea: area.codigo, codigoCargo: cargo.codigo },
        });
        expect(r.status).toBe(200);
        expect(r.corpo.nome).toBe("Ana S.");
        expect(r.corpo.areas).toEqual([]);
    });

    it("perfil informa se quem olha pode gerir a pessoa", async () => {
        await darCargo(ctx.factory, diretora, "diretor");
        const doGerente = await servidor.chamar("get", `/usuarios/${ctx.membro.codigo}/perfil`, { usuario: ctx.gerente });
        expect(doGerente.corpo.podeGerir).toBe(true);
        const doMembro = await servidor.chamar("get", `/usuarios/${ctx.membro.codigo}/perfil`, { usuario: ctx.membro });
        expect(doMembro.corpo.podeGerir).toBe(false);
        const daDiretora = await servidor.chamar("get", `/usuarios/${diretora.codigo}/perfil`, { usuario: ctx.gerente });
        expect(daDiretora.corpo.podeGerir).toBe(false);
    });

    it("gerente não mexe nos próprios períodos: 403 PERIODO.PROPRIO; perfil próprio sem podeGerir", async () => {
        const meu = await servidor.chamar("post", caminho(ctx.membro), { usuario: ctx.gerente, corpo: corpo() });
        const codigoPeriodo = meu.corpo.codigo;
        const post = await servidor.chamar("post", caminho(ctx.gerente), { usuario: ctx.gerente, corpo: corpo() });
        expect(post.status).toBe(403);
        expect(JSON.stringify(post.corpo)).toContain("próprios períodos");
        expect((await servidor.chamar("put", `${caminho(ctx.gerente)}/x`, { usuario: ctx.gerente, corpo: corpo() })).status).toBe(403);
        expect((await servidor.chamar("delete", `${caminho(ctx.gerente)}/x`, { usuario: ctx.gerente })).status).toBe(403);
        const perfil = await servidor.chamar("get", `/usuarios/${ctx.gerente.codigo}/perfil`, { usuario: ctx.gerente });
        expect(perfil.corpo.podeGerir).toBe(false);
        // continua podendo no período de um membro
        expect((await servidor.chamar("delete", `${caminho(ctx.membro)}/${codigoPeriodo}`, { usuario: ctx.gerente })).status).toBe(204);
    });

    it("só o presidente altera os próprios períodos", async () => {
        diretora = comPapel(diretora, "presidente");
        const criado = await servidor.chamar("post", caminho(diretora), { usuario: diretora, corpo: corpo() });
        expect(criado.status).toBe(200);
        const editado = await servidor.chamar("put", `${caminho(diretora)}/${criado.corpo.codigo}`, {
            usuario: diretora,
            corpo: corpo({ inicio: "2026-01-10" }),
        });
        expect(editado.status).toBe(200);
        const perfil = await servidor.chamar("get", `/usuarios/${diretora.codigo}/perfil`, { usuario: diretora });
        expect(perfil.corpo.podeGerir).toBe(true);
        expect((await servidor.chamar("delete", `${caminho(diretora)}/${criado.corpo.codigo}`, { usuario: diretora })).status).toBe(204);
    });
});
