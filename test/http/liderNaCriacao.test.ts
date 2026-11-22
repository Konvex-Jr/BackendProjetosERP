import Usuario from "../../source/domain/entity/Usuario";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import StatusPessoa from "../../source/domain/enum/StatusPessoa";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 27b: o projeto só tem líder (o responsável saiu) e o líder é escolhido já na criação. */
describe("Líder na criação do projeto", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let trainee: Usuario;
    let inativo: Usuario;

    const corpo = (extra: object = {}) => ({ nome: "Projeto Boreal", descricao: "d", dataInicio, dataFim, ...extra });
    const criar = (extra: object, usuario = ctx.gerente) => servidor.chamar("post", "/projetos", { usuario, corpo: corpo(extra) });

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        trainee = new Usuario("Tito", "tito@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-tito", {
            status: StatusPessoa.TRAINEE,
        });
        inativo = new Usuario("Ivo", "ivo@konvex.com.br", PerfilUsuario.MEMBRO, false, "x", ctx.senioridade, "usr-ivo", {
            status: StatusPessoa.INATIVO,
        });
        await usuarios.criar(trainee);
        await usuarios.criar(inativo);
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

    it("trainee não lidera: 400 TRAINEE_NAO_LIDERA", async () => {
        const r = await criar({ codigoLider: trainee.codigo });
        expect(r.status).toBe(400);
        expect(r.corpo.code ?? r.corpo.codigo).toBe("TRAINEE_NAO_LIDERA");
    });

    it("líder fora da EJ ou inexistente: 404", async () => {
        expect((await criar({ codigoLider: inativo.codigo })).status).toBe(404);
        expect((await criar({ codigoLider: "usr-nada" })).status).toBe(404);
    });

    it("sigiloso: ser o líder conta como estar na equipe", async () => {
        expect((await criar({ sigiloso: true, codigoLider: ctx.gerente.codigo })).status).toBe(200);
        const fora = await criar({ sigiloso: true, codigoLider: ctx.membro.codigo });
        expect(fora.status).toBe(400);
    });
});
