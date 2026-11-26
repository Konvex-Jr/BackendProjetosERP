import Area from "../../source/domain/entity/Area";
import Cargo from "../../source/domain/entity/Cargo";
import PeriodoArea from "../../source/domain/entity/PeriodoArea";
import Usuario from "../../source/domain/entity/Usuario";
import StatusPessoa from "../../source/domain/enum/StatusPessoa";
import { PADRAO_GERENTE, PADRAO_MEMBRO, Permissao } from "../../source/shared/seguranca/catalogoPermissoes";
import { criarContexto, dataFim, dataInicio, obrigatoriosDoProjeto } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/**
 * Sessão 31a, tabela 5.8 do spec: as regras gerais que eram fixas (trainee sem Biblioteca, trainee não lidera,
 * qualquer um cria reunião, só a gestão faz a chamada, menu) passam a vir das permissões da grade.
 * Pessoas aqui não usam papel de teste: as permissões vêm do cargo ou dos conjuntos, como em produção.
 */
describe("Regras fixas que viraram permissão (31a)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let trainee: Usuario;
    let membro: Usuario;

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        trainee = (await usuarios.criar(
            new Usuario("Téo", "teo@konvex.com.br", true, "x", ctx.senioridade, "usr-teo", { status: StatusPessoa.TRAINEE }),
        ))!;
        membro = (await usuarios.criar(new Usuario("Mel", "mel@konvex.com.br", true, "x", ctx.senioridade, "usr-mel")))!;
        await obrigatoriosDoProjeto(ctx.factory);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const chamar = (metodo: string, caminho: string, usuario: Usuario, corpo?: unknown) =>
        servidor.chamar(metodo, caminho, { usuario, corpo });
    const conjuntos = () => ctx.factory.criarPermissoesRepository();

    it("Biblioteca: trainee sem biblioteca.usar 403; ligando no conjunto Trainee, entra", async () => {
        expect((await chamar("get", "/biblioteca", trainee)).status).toBe(403);
        await conjuntos().gravarConjunto("trainee", [...(await conjuntos().conjunto("trainee")), Permissao.BIBLIOTECA_USAR]);
        expect((await chamar("get", "/biblioteca", trainee)).status).toBe(200);
    });

    it("Biblioteca: membro sem cargo perde o acesso se o conjunto Sem cargo perder biblioteca.usar", async () => {
        expect((await chamar("get", "/biblioteca", membro)).status).toBe(200);
        await conjuntos().gravarConjunto(
            "sem_cargo",
            PADRAO_MEMBRO.filter((p) => p !== Permissao.BIBLIOTECA_USAR),
        );
        expect((await chamar("get", "/biblioteca", membro)).status).toBe(403);
        const perms = await chamar("get", "/auth/permissoes", membro);
        expect(perms.corpo.menu.map((m: any) => m.chave)).not.toContain("biblioteca");
    });

    it("Líder: quem não tem projetos.liderar não é escolhido (400 LIDER_SEM_PERMISSAO)", async () => {
        const diretor = await ctx.factory
            .criarUsuarioRepository()
            .criar(new Usuario("Dora", "dora@konvex.com.br", true, "x", ctx.senioridade, "usr-dora"));
        const area = await ctx.factory.criarAreaRepository().criar(new Area("Presidência"));
        const presidente = await ctx.factory.criarCargoRepository().criar(new Cargo("Presidente", true, "c-pres", true, 20, 1, []));
        await ctx.factory.criarPeriodoAreaRepository().criar(new PeriodoArea(diretor!.codigo, area, presidente, dataInicio, null, null));
        const corpo = (codigoLider: string) => ({
            nome: "Novo",
            descricao: "d",
            dataInicio: dataInicio.toISOString().slice(0, 10),
            dataFim: dataFim.toISOString().slice(0, 10),
            codigoLider,
            codigoClasse: "outro",
            codigoArea: "area-clientes-teste",
        });
        const r = await chamar("post", "/projetos", diretor!, corpo(trainee.codigo));
        expect(r.status).toBe(400);
        expect(r.corpo.codigo).toBe("LIDER_SEM_PERMISSAO");
        expect((await chamar("post", "/projetos", diretor!, corpo(membro.codigo))).status).toBe(200);
    });

    it("Reunião: sem reunioes.criar, 403", async () => {
        const reuniao = { titulo: "R", data: "2026-12-01", inicio: "10:00", fim: "11:00", participantes: [] };
        await conjuntos().gravarConjunto(
            "sem_cargo",
            PADRAO_MEMBRO.filter((p) => p !== Permissao.REUNIOES_CRIAR),
        );
        expect((await chamar("post", "/reunioes", membro, reuniao)).status).toBe(403);
    });

    it("Capacitações: chamada com capacitacoes.presenca; criar só com capacitacoes.gerir; sem capacitacoes.ver, 403 e fora do menu", async () => {
        const area = await ctx.factory.criarAreaRepository().criar(new Area("Gente"));
        const soChamada = PADRAO_GERENTE.filter((p) => p !== Permissao.CAPACITACOES_GERIR);
        const cargo = await ctx.factory.criarCargoRepository().criar(new Cargo("Assessor de gente", true, "c-ag", false, 10, 4, soChamada));
        await ctx.factory.criarPeriodoAreaRepository().criar(new PeriodoArea(membro.codigo, area, cargo, dataInicio, null, null));
        const chamada = await chamar("put", `/capacitacoes/${ctx.capacitacao.codigo}/presencas`, membro, { presentes: [] });
        expect(chamada.status).not.toBe(403);
        const nova = await chamar("post", "/capacitacoes", membro, { titulo: "X" });
        expect(nova.status).toBe(403);

        await conjuntos().gravarConjunto(
            "trainee",
            (await conjuntos().conjunto("trainee")).filter((p) => p !== Permissao.CAPACITACOES_VER),
        );
        expect((await chamar("get", "/capacitacoes", trainee)).status).toBe(403);
        const menu = (await chamar("get", "/auth/permissoes", trainee)).corpo.menu.map((m: any) => m.chave);
        expect(menu).not.toContain("capacitacoes");
    });
});
