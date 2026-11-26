import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import Projeto from "../source/domain/entity/Projeto";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";
import Usuario from "../source/domain/entity/Usuario";
import { novoGeral } from "../source/domain/entity/ProjetoGeral";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import TipoProjeto from "../source/domain/enum/TipoProjeto";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** O mesmo cenário do teste de integração (test/integracao/projetoGeral.int.ts), na memória. */
describe("projeto geral no repositório em memória", () => {
    let factory: MemoryRepositoryFactory;
    let inovacao: Area;
    let ana: Usuario;
    let bia: Usuario;
    let caio: Usuario;
    let duda: Usuario;
    let geral: Projeto;
    let interno: Projeto;
    let cliente: Projeto;

    async function novaPessoa(nome: string): Promise<Usuario> {
        const p = new Usuario(nome, `${nome}@teste.com`, PerfilUsuario.MEMBRO, true, "h", new SenioridadeUsuario("pleno", "Pleno", 75));
        await factory.criarUsuarioRepository().criar(p);
        return p;
    }

    beforeEach(async () => {
        factory = new MemoryRepositoryFactory();
        const areas = factory.criarAreaRepository();
        const projetosArea = await areas.criar(new Area("Projetos"));
        inovacao = await areas.criar(new Area("Inovação", projetosArea.codigo));
        const gerente = await factory.criarCargoRepository().criar(new Cargo("Gerente", true, undefined, true));
        ana = await novaPessoa("ana");
        bia = await novaPessoa("bia");
        caio = await novaPessoa("caio");
        duda = await novaPessoa("duda");
        const periodos = factory.criarPeriodoAreaRepository();
        await periodos.criar(new PeriodoArea(ana.codigo, inovacao, null, dia("2026-01-10"), null, null));
        await periodos.criar(new PeriodoArea(bia.codigo, inovacao, null, dia("2025-01-10"), dia("2026-01-10"), null));
        await periodos.criar(new PeriodoArea(caio.codigo, projetosArea, gerente, dia("2026-01-10"), null, null));

        const repo = factory.criarProjetoRepository();
        geral = await repo.criar(novoGeral(inovacao, dia("2026-11-19")));
        interno = await repo.criar(
            new Projeto("Interno", "D", dia("2026-11-01"), dia("2026-12-01"), undefined, [duda], undefined, {
                area: inovacao,
                tipo: TipoProjeto.INTERNO,
            }),
        );
        cliente = await repo.criar(new Projeto("Cliente", "D", dia("2026-11-01"), dia("2026-12-01"), undefined, [duda]));
    });

    test("equipe pelos períodos, liderança pelos cargos que lideram", async () => {
        const lido = (await factory.criarProjetoRepository().buscarPorCodigo(geral.codigo))!;
        expect(lido.membros.map((m) => m.codigo)).toEqual([ana.codigo]);
        // Desde 25/11 quem saiu da área não aparece como ex-membro do geral.
        expect(lido.participacoes.some((p) => p.usuario.codigo === bia.codigo)).toBe(false);
        expect(lido.lideresDaArea).toEqual([caio.codigo]);
        expect(lido.lider).toBeNull();
        expect((await factory.criarProjetoRepository().buscarGeralDaArea(inovacao.codigo))!.codigo).toBe(geral.codigo);
    });

    test("listarPorMembro inclui o geral a quem está na área ou lidera; quem saiu não", async () => {
        const repo = factory.criarProjetoRepository();
        const codigos = async (u: Usuario) => (await repo.listarPorMembro(u.codigo)).map((p) => p.codigo);
        expect(await codigos(ana)).toContain(geral.codigo);
        expect(await codigos(bia)).not.toContain(geral.codigo);
        expect(await codigos(caio)).toContain(geral.codigo);
        expect(await codigos(duda)).toEqual([interno.codigo, cliente.codigo]);
    });

    test("editar o geral não guarda equipe; a equipe segue vindo dos períodos", async () => {
        const repo = factory.criarProjetoRepository();
        const lido = (await repo.buscarPorCodigo(geral.codigo))!;
        await repo.editar(lido.copiar({ participacoes: [...lido.participacoes], lider: ana }));
        await factory.criarPeriodoAreaRepository().encerrarAbertosDe(ana.codigo, dia("2026-11-20"));
        const relido = (await repo.buscarPorCodigo(geral.codigo))!;
        expect(relido.membros).toEqual([]);
        expect(relido.lider).toBeNull();
    });

    test("listar filtra por tipo", async () => {
        const repo = factory.criarProjetoRepository();
        expect((await repo.listar({ tipo: TipoProjeto.INTERNO })).map((p) => p.codigo)).toEqual([geral.codigo, interno.codigo]);
        expect((await repo.listar({ tipo: TipoProjeto.CLIENTE })).map((p) => p.codigo)).toEqual([cliente.codigo]);
    });
});
