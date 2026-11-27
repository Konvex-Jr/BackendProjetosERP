import Usuario from "../../source/domain/entity/Usuario";
import StatusPessoa from "../../source/domain/enum/StatusPessoa";
import { criarContexto, dataFim, dataInicio, obrigatoriosDoProjeto } from "../fixtures";
import { subirServidor } from "./servidorTeste";
import { comPapel } from "../papel";

/** Sessão 27b: o projeto só tem líder (o responsável saiu) e o líder é escolhido já na criação. */
describe("Líder na criação do projeto", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let trainee: Usuario;
    let inativo: Usuario;

    const corpo = (extra: object = {}) => ({
        nome: "Projeto Boreal",
        descricao: "d",
        dataInicio,
        dataFim,
        codigoClasse: "outro",
        codigoArea: "area-clientes-teste",
        ...extra,
    });
    const criar = (extra: object, usuario = ctx.gerente) => servidor.chamar("post", "/projetos", { usuario, corpo: corpo(extra) });

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        trainee = comPapel(
            new Usuario("Tito", "tito@konvex.com.br", true, "x", ctx.senioridade, "usr-tito", {
                status: StatusPessoa.TRAINEE,
            }),
            "membro",
        );
        inativo = comPapel(
            new Usuario("Ivo", "ivo@konvex.com.br", false, "x", ctx.senioridade, "usr-ivo", {
                status: StatusPessoa.INATIVO,
            }),
            "membro",
        );
        await usuarios.criar(trainee);
        await usuarios.criar(inativo);
        await obrigatoriosDoProjeto(ctx.factory);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("líder fora da lista de membros entra na equipe e fica como líder", async () => {
        const r = await criar({ codigoLider: ctx.membro.codigo, codigosMembros: [] });
        expect(r.status).toBe(200);
        expect(r.corpo.lider.codigo).toBe(ctx.membro.codigo);
        expect(r.corpo.membros.map((m: any) => m.codigo)).toEqual([ctx.membro.codigo]);
        expect(r.corpo).not.toHaveProperty("responsavel");
    });

    it("líder já na lista de membros não duplica", async () => {
        const r = await criar({ codigoLider: ctx.membro.codigo, codigosMembros: [ctx.membro.codigo] });
        expect(r.corpo.membros).toHaveLength(1);
    });

    it("sem líder segue valendo (projeto sem líder)", async () => {
        const r = await criar({});
        expect(r.status).toBe(200);
        expect(r.corpo.lider).toBeNull();
    });

    it("trainee não lidera (sem projetos.liderar): 400 LIDER_SEM_PERMISSAO", async () => {
        const r = await criar({ codigoLider: trainee.codigo });
        expect(r.status).toBe(400);
        expect(r.corpo.code ?? r.corpo.codigo).toBe("LIDER_SEM_PERMISSAO");
    });

    it("líder fora da EJ ou inexistente: 404", async () => {
        expect((await criar({ codigoLider: inativo.codigo })).status).toBe(404);
        expect((await criar({ codigoLider: "usr-nada" })).status).toBe(404);
    });

    it("quem cria não fica de fora (31a): ser o líder conta como estar na equipe", async () => {
        comPapel(ctx.gerente, "gerenteDaArea");
        expect((await criar({ codigoLider: ctx.gerente.codigo })).status).toBe(200);
        const fora = await criar({ codigoLider: ctx.membro.codigo });
        expect(fora.status).toBe(400);
    });
});
