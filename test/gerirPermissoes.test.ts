import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import Usuario from "../source/domain/entity/Usuario";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import { PADRAO_DIRETOR, PADRAO_GERENTE, PADRAO_MEMBRO, Permissao } from "../source/shared/seguranca/catalogoPermissoes";
import { permissoesEfetivas } from "../source/shared/seguranca/permissoesEfetivas";
import GerirPermissoes from "../source/useCases/config/GerirPermissoes";
import SalvarCargo from "../source/useCases/config/SalvarCargo";
import { efetivasDoPapel } from "./papel";

async function contexto() {
    const f = new MemoryRepositoryFactory();
    const cargos = f.criarCargoRepository();
    const presidente = await cargos.criar(new Cargo("Presidente", true, "c-pres", true, 20, 1, []));
    const diretorCargo = await cargos.criar(new Cargo("Diretor de projetos", true, "c-dir", true, 20, 2, PADRAO_DIRETOR));
    const gerenteCargo = await cargos.criar(new Cargo("Gerente de projetos", true, "c-ger", false, 20, 3, PADRAO_GERENTE));
    const assessor = await cargos.criar(new Cargo("Assessor", true, "c-ass", false, 10, 4, PADRAO_MEMBRO));
    const diretor = { codigo: "dir", ...efetivasDoPapel("diretor") };
    return { f, gerir: new GerirPermissoes(f), presidente, diretorCargo, gerenteCargo, assessor, diretor };
}

describe("GerirPermissoes (grade, sessão 31a)", () => {
    test("grade: cargos por posição, depois Sem cargo e Trainee; podeAlterar só abaixo de quem olha", async () => {
        const { gerir, diretor } = await contexto();
        const grade = await gerir.grade(diretor);
        expect(grade.colunas.map((c) => [c.chave, c.podeAlterar])).toEqual([
            ["c-pres", false],
            ["c-dir", false],
            ["c-ger", true],
            ["c-ass", true],
            ["sem_cargo", true],
            ["trainee", true],
        ]);
        expect(grade.catalogo.length).toBeGreaterThan(20);
        expect(grade.colunas[0].permissoes).toContain(Permissao.PERMISSOES_GERIR);
    });

    test("sem permissoes.gerir: 403", async () => {
        const { gerir } = await contexto();
        await expect(gerir.grade({ codigo: "ger", ...efetivasDoPapel("gerente") })).rejects.toMatchObject({ codigoHttp: 403 });
    });

    test("salvar coluna grava e a pessoa do cargo já recebe na leitura seguinte", async () => {
        const { f, gerir, diretor, gerenteCargo } = await contexto();
        const pessoa = (await f.criarUsuarioRepository().criar(new Usuario("Bia", "bia@konvex.com.br", true, "h", null, "usr-bia")))!;
        const area = await f.criarAreaRepository().criar(new Area("Projetos"));
        await f.criarPeriodoAreaRepository().criar(new PeriodoArea(pessoa.codigo, area, gerenteCargo, new Date("2026-01-01"), null, null));
        const sem = PADRAO_GERENTE.filter((p) => p !== Permissao.ESTRATEGIA_VER);
        await gerir.salvarColuna(diretor, "c-ger", sem);
        expect((await permissoesEfetivas(pessoa, f)).permissoes).not.toContain(Permissao.ESTRATEGIA_VER);
    });

    test("conjuntos: salvar Trainee grava o conjunto", async () => {
        const { f, gerir, diretor } = await contexto();
        await gerir.salvarColuna(diretor, "trainee", [Permissao.TAREFAS_VER]);
        expect(await f.criarPermissoesRepository().conjunto("trainee")).toEqual([Permissao.TAREFAS_VER]);
    });

    test("cargo do próprio nível: 403; chave inexistente: 404; permissão desconhecida: 400", async () => {
        const { gerir, diretor } = await contexto();
        await expect(gerir.salvarColuna(diretor, "c-dir", [])).rejects.toMatchObject({ codigoHttp: 403 });
        await expect(gerir.salvarColuna(diretor, "nao-existe", [])).rejects.toMatchObject({ codigoHttp: 404 });
        await expect(gerir.salvarColuna(diretor, "c-ass", ["projetos.verTodos"])).rejects.toMatchObject({ codigoHttp: 400 });
        await expect(gerir.salvarColuna(diretor, "c-ass", "x")).rejects.toMatchObject({ codigoHttp: 400 });
    });

    test("não concede o que não tem", async () => {
        const { gerir } = await contexto();
        const semClientes = { codigo: "d2", ...efetivasDoPapel("diretor") };
        semClientes.permissoes = semClientes.permissoes.filter((p) => p !== Permissao.CLIENTES_VER);
        await expect(gerir.salvarColuna(semClientes, "c-ass", [Permissao.CLIENTES_VER])).rejects.toMatchObject({ codigoHttp: 403 });
    });
});

describe("SalvarCargo com hierarquia (sessão 31a)", () => {
    test("diretor cria cargo abaixo do seu (posição 3), não no seu nível (2) nem presidente (1)", async () => {
        const { f, diretor } = await contexto();
        const salvar = new SalvarCargo(f);
        const novo = await salvar.execute({ nome: "Gerente de inovação", posicao: 3, quem: diretor });
        expect(novo.posicao).toBe(3);
        expect([...novo.permissoes].sort()).toEqual([...PADRAO_MEMBRO].sort());
        await expect(salvar.execute({ nome: "Outro diretor", posicao: 2, quem: diretor })).rejects.toMatchObject({ codigoHttp: 403 });
        await expect(salvar.execute({ nome: "Outro presidente", posicao: 1, quem: diretor })).rejects.toMatchObject({ codigoHttp: 403 });
    });

    test("diretor não edita cargo do próprio nível; edita o de baixo, sem subir acima dele", async () => {
        const { f, diretor } = await contexto();
        const salvar = new SalvarCargo(f);
        await expect(salvar.execute({ codigo: "c-dir", nome: "Diretor X", quem: diretor })).rejects.toMatchObject({ codigoHttp: 403 });
        expect((await salvar.execute({ codigo: "c-ger", nome: "Gerente de projetos", tetoSemanalHoras: 20, quem: diretor })).posicao).toBe(
            3,
        );
        await expect(salvar.execute({ codigo: "c-ger", nome: "Gerente de projetos", posicao: 2, quem: diretor })).rejects.toMatchObject({
            codigoHttp: 403,
        });
    });

    test("presidente renomeia o próprio cargo, mas não muda a posição nem desativa", async () => {
        const { f } = await contexto();
        const presidente = { codigo: "pres", ...efetivasDoPapel("presidente") };
        const salvar = new SalvarCargo(f);
        expect((await salvar.execute({ codigo: "c-pres", nome: "Presidência", quem: presidente })).nome).toBe("Presidência");
        await expect(salvar.execute({ codigo: "c-pres", nome: "Presidência", posicao: 2, quem: presidente })).rejects.toMatchObject({
            codigoHttp: 403,
        });
        await expect(salvar.execute({ codigo: "c-pres", nome: "Presidência", ativo: false, quem: presidente })).rejects.toMatchObject({
            codigoHttp: 403,
        });
    });

    test("desativar cargo com alguém num período aberto: 409 CARGO_COM_OCUPANTES", async () => {
        const { f, diretor, assessor } = await contexto();
        const area = await f.criarAreaRepository().criar(new Area("Projetos"));
        const pessoa = (await f.criarUsuarioRepository().criar(new Usuario("Ivo", "ivo@konvex.com.br", true, "h", null, "usr-ivo")))!;
        await f.criarPeriodoAreaRepository().criar(new PeriodoArea(pessoa.codigo, area, assessor, new Date("2026-01-01"), null, null));
        await expect(new SalvarCargo(f).execute({ codigo: "c-ass", nome: "Assessor", ativo: false, quem: diretor })).rejects.toMatchObject({
            codigo: "CARGO_COM_OCUPANTES",
        });
    });
});
