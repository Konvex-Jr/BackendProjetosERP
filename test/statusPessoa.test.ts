import StatusPessoa from "../source/domain/enum/StatusPessoa";
import AlterarStatusPessoa from "../source/useCases/pessoas/AlterarStatusPessoa";
import { AdicionarParticipante } from "../source/useCases/projetos/Equipe";
import ObterPerfilPessoa from "../source/useCases/pessoas/ObterPerfilPessoa";
import Area from "../source/domain/entity/Area";
import Cargo from "../source/domain/entity/Cargo";
import PeriodoArea from "../source/domain/entity/PeriodoArea";
import { criarContexto, criarProjeto } from "./fixtures";

describe("Status de pessoa (RF-011, RN-01)", () => {
    it("trainee está na EJ, entra em projetos e tem acesso ao sistema", async () => {
        const { factory, membro, gerente } = await criarContexto();
        const novo = membro.copiar({ status: StatusPessoa.TRAINEE });
        await factory.criarUsuarioRepository().editar(novo);
        const usuario = (await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo))!;
        expect(usuario.ativo).toBe(true);
        expect(usuario.naEj).toBe(true);

        const projeto = await criarProjeto(factory, gerente);
        const { projeto: comTrainee } = await new AdicionarParticipante(factory).execute({
            codigoProjeto: projeto.codigo,
            codigoUsuario: membro.codigo,
        });
        expect(comTrainee.membros.map((m) => m.codigo)).toContain(membro.codigo);
    });

    it("ninguém volta a ser trainee", async () => {
        const { factory, membro } = await criarContexto();
        await expect(
            new AlterarStatusPessoa(factory).execute({ codigo: membro.codigo, status: StatusPessoa.TRAINEE }),
        ).rejects.toMatchObject({ codigo: "STATUS_TRAINEE_SO_NA_ENTRADA" });
    });

    it("a saída encerra as participações, mas o histórico continua no perfil (CT-012)", async () => {
        const { factory, membro } = await criarContexto();
        await criarProjeto(factory, membro);
        const resultado = await new AlterarStatusPessoa(factory).execute({ codigo: membro.codigo, status: StatusPessoa.ALUMNI });
        expect(resultado.participacoesEncerradas).toBe(1);
        expect(resultado.usuario.dataSaida).not.toBeNull();

        const perfil = await new ObterPerfilPessoa(factory).execute(membro.codigo);
        expect(perfil.projetosAtuais).toHaveLength(0);
        expect(perfil.projetosAnteriores).toHaveLength(1);
        expect(await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo)).not.toBeNull();
    });

    it("a saída sempre encerra os períodos em aberto na data de saída, mesmo sem encerrar participações", async () => {
        const { factory, membro } = await criarContexto();
        await criarProjeto(factory, membro);
        const area = await factory.criarAreaRepository().criar(new Area("Projetos"));
        const periodos = factory.criarPeriodoAreaRepository();
        const inicio = new Date("2026-02-01T00:00:00.000Z");
        const saida = new Date("2026-09-01T00:00:00.000Z");
        await periodos.criar(new PeriodoArea(membro.codigo, area, null, inicio, null, null));

        const resultado = await new AlterarStatusPessoa(factory).execute({
            codigo: membro.codigo,
            status: StatusPessoa.ALUMNI,
            dataSaida: saida,
            encerrarParticipacoes: false,
        });
        expect(resultado.periodosEncerrados).toBe(1);
        expect(resultado.participacoesEncerradas).toBe(0);
        expect((await periodos.listarDe(membro.codigo))[0].fim).toEqual(saida);
        const perfil = await new ObterPerfilPessoa(factory).execute(membro.codigo);
        expect(perfil.projetosAtuais).toHaveLength(1);
    });

    it("a saída encerra períodos mesmo com dois cargos sobrepostos de dados antigos", async () => {
        const { factory, membro } = await criarContexto();
        const a = await factory.criarAreaRepository().criar(new Area("Projetos"));
        const b = await factory.criarAreaRepository().criar(new Area("Marketing"));
        const cargo = await factory.criarCargoRepository().criar(new Cargo("Assessor"));
        const periodos = factory.criarPeriodoAreaRepository();
        const inicio = new Date("2026-02-01T00:00:00.000Z");
        await periodos.criar(new PeriodoArea(membro.codigo, a, cargo, inicio, null, null));
        await periodos.criar(new PeriodoArea(membro.codigo, b, cargo, inicio, null, null));
        const saida = new Date("2026-09-01T00:00:00.000Z");
        const resultado = await new AlterarStatusPessoa(factory).execute({
            codigo: membro.codigo,
            status: StatusPessoa.ALUMNI,
            dataSaida: saida,
            encerrarParticipacoes: false,
        });
        expect(resultado.periodosEncerrados).toBe(2);
    });
});
