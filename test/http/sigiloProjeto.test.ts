import Area from "../../source/domain/entity/Area";
import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import StatusPessoa from "../../source/domain/enum/StatusPessoa";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";
import { Papel, comPapel } from "../papel";

/** Sessão 20 (regra da 27a): escrita em projeto sigiloso (criar, sigilo, rotas protegidas); sem lista de acesso. */
describe("Escrita em projeto fechado (era o sigiloso; 31a: todo projeto é fechado)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let diretor: Usuario;
    let criador: Usuario; // gerente que criou, fora da equipe
    let gerenteEquipe: Usuario; // gerente na equipe atual, não criador
    let gerenteFora: Usuario;
    let novo: Usuario; // membro fora do projeto

    const corpoProjeto = (extra: object = {}) => ({
        nome: "Projeto Aurora",
        descricao: "descrição",
        dataInicio,
        dataFim,
        ...extra,
    });

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const novoUsuario = async (nome: string, perfil: Papel, codigo: string, status?: StatusPessoa) => {
            const u = comPapel(
                new Usuario(nome, `${codigo}@konvex.com.br`, true, "x", ctx.senioridade, codigo, status ? { status } : {}),
                perfil,
            );
            await usuarios.criar(u);
            return u;
        };
        diretor = await novoUsuario("Dora", "diretor", "usr-dora");
        criador = await novoUsuario("Caio", "gerente", "usr-caio");
        gerenteEquipe = await novoUsuario("Gil", "gerente", "usr-gil");
        gerenteFora = await novoUsuario("Fábio", "gerenteDaArea", "usr-fabio");
        novo = await novoUsuario("Nina", "membro", "usr-nina");
        await ctx.factory.criarProjetoRepository().criar(
            new Projeto("Sigiloso", "descrição", dataInicio, dataFim, undefined, [ctx.membro, gerenteEquipe], "proj-sig", {
                criadoPor: criador.codigo,
            }),
        );
        await ctx.factory
            .criarProjetoRepository()
            .criar(
                new Projeto("Normal", "descrição", dataInicio, dataFim, undefined, [ctx.membro], "proj-nor", { criadoPor: criador.codigo }),
            );
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const chamar = (metodo: string, caminho: string, usuario: Usuario, corpo?: unknown) =>
        servidor.chamar(metodo, caminho, { usuario, corpo });

    describe("POST /projetos (31a: quem cria não fica de fora)", () => {
        const corpo = (extra: Record<string, unknown> = {}) => ({
            nome: "Novo",
            descricao: "d",
            dataInicio: "2026-10-12",
            dataFim: "2026-10-30",
            ...extra,
        });

        it("gerente de outra área sem estar na equipe: 400 SEM_ACESSO_AO_CRIAR; entrando na equipe, cria", async () => {
            const fora = await chamar("post", "/projetos", gerenteFora, corpo());
            expect(fora.status).toBe(400);
            expect(fora.corpo.code ?? fora.corpo.codigo).toBe("SEM_ACESSO_AO_CRIAR");
            const dentro = await chamar("post", "/projetos", gerenteFora, corpo({ codigosMembros: [gerenteFora.codigo] }));
            expect(dentro.status).toBe(200);
        });

        it("diretor cria sem estar na equipe (abre todos)", async () => {
            expect((await chamar("post", "/projetos", diretor, corpo())).status).toBe(200);
        });
    });

    describe("PUT /projetos/:codigo (31a: quem edita não se tranca fora ao trocar a área)", () => {
        it("gerente da área, fora da equipe, troca a área para outra: 400 SEM_ACESSO_AO_CRIAR; manter a área: 200", async () => {
            const areas = ctx.factory.criarAreaRepository();
            const daArea = await areas.criar(new Area("Projetos de teste", null, true, "area-projetos-teste"));
            const outra = await areas.criar(new Area("Outra área"));
            const projetos = ctx.factory.criarProjetoRepository();
            const atual = (await projetos.buscarPorCodigo("proj-nor"))!;
            await projetos.editar(atual.copiar({ area: daArea }));
            const corpo = (codigoArea: string) => ({
                nome: "Normal",
                descricao: "descrição",
                dataInicio: "2026-10-12",
                dataFim: "2026-10-30",
                codigoArea,
            });
            const trancaria = await chamar("put", "/projetos/proj-nor", gerenteFora, corpo(outra.codigo));
            expect(trancaria.status).toBe(400);
            expect(trancaria.corpo.code ?? trancaria.corpo.codigo).toBe("SEM_ACESSO_AO_CRIAR");
            expect((await chamar("put", "/projetos/proj-nor", gerenteFora, corpo(daArea.codigo))).status).toBe(200);
            expect((await chamar("put", "/projetos/proj-nor", diretor, corpo(outra.codigo))).status).toBe(200);
        });
    });

    describe("PUT /projetos/:codigo/acesso (saiu na sessão 27a)", () => {
        it("rota inexistente: 404 no sigiloso e no normal, até para o diretor", async () => {
            expect((await chamar("put", "/projetos/proj-sig/acesso", diretor, { codigos: [] })).status).toBe(404);
            expect((await chamar("put", "/projetos/proj-nor/acesso", criador, { codigos: [] })).status).toBe(404);
        });
    });

    describe("rotas de escrita para gerente fora", () => {
        it("PUT, PATCH status, POST membros, PUT lider: 403; diretor exclui", async () => {
            expect((await chamar("put", "/projetos/proj-sig", gerenteFora, corpoProjeto())).status).toBe(403);
            expect((await chamar("patch", "/projetos/proj-sig/status", gerenteFora, { status: "concluido" })).status).toBe(403);
            expect((await chamar("post", "/projetos/proj-sig/membros", gerenteFora, { codigoUsuario: novo.codigo })).status).toBe(403);
            expect((await chamar("put", "/projetos/proj-sig/lider", gerenteFora, { codigoUsuario: null })).status).toBe(403);
            expect((await chamar("delete", "/projetos/proj-sig", diretor)).status).toBe(200);
        });

        it("membro fora do sigiloso lê o cartão (200), sem os detalhes", async () => {
            const r = await chamar("get", "/projetos/proj-sig", novo);
            expect(r.status).toBe(200);
            expect(r.corpo.cartao).toBe(true);
        });

        it("encerrar e editar participação: gerente fora 403", async () => {
            const sig = await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-sig");
            const cod = sig!.participacoes[0].codigo;
            expect((await chamar("put", `/projetos/proj-sig/membros/${cod}`, gerenteFora, { funcao: "Dev" })).status).toBe(403);
            expect((await chamar("post", `/projetos/proj-sig/membros/${cod}/encerrar`, gerenteFora, {})).status).toBe(403);
        });
    });
});
