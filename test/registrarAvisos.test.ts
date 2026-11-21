import Usuario from "../source/domain/entity/Usuario";
import StatusPessoa from "../source/domain/enum/StatusPessoa";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import CriarTarefa from "../source/useCases/tarefas/CriarTarefa";
import EditarTarefa from "../source/useCases/tarefas/EditarTarefa";
import GerirCapacitacoes from "../source/useCases/capacitacoes/GerirCapacitacoes";
import { avisarTarefaRecebida } from "../source/useCases/avisos/registrarAvisos";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import { criarContexto, dataInicio, dataFim } from "./fixtures";
import Projeto from "../source/domain/entity/Projeto";

async function cenario() {
    const ctx = await criarContexto();
    const { factory, membro, gerente, senioridade } = ctx;
    const mk = async (nome: string, codigo: string, status = StatusPessoa.ATIVO, senha = "h") => {
        const u = new Usuario(
            nome,
            `${codigo}@konvex.com.br`,
            PerfilUsuario.MEMBRO,
            status !== StatusPessoa.INATIVO,
            senha,
            senioridade,
            codigo,
            { status },
        );
        await factory.criarUsuarioRepository().criar(u);
        return u;
    };
    const c = await mk("Carla", "usr-carla");
    const projeto = await factory
        .criarProjetoRepository()
        .criar(new Projeto("P", "D", dataInicio, dataFim, undefined, [membro, gerente, c], "proj-av"));
    const criar = (responsaveis: Usuario[]) =>
        factory.emTransacao(async (tx) => {
            const t = await new CriarTarefa(tx).execute({
                codigoProjeto: projeto.codigo,
                titulo: "T",
                dataInicio,
                dataFim,
                prioridade: PrioridadeTarefa.P1,
                codigosResponsaveis: responsaveis.map((r) => r.codigo),
                criadaPor: membro,
            });
            await avisarTarefaRecebida(tx, null, t, membro.codigo);
            return t;
        });
    const editar = (antes: any, responsaveis: Usuario[]) =>
        factory.emTransacao(async (tx) => {
            const t = await new EditarTarefa(tx).execute({
                codigo: antes.codigo,
                titulo: "T",
                dataInicio,
                dataFim,
                status: StatusTarefa.PENDENTE,
                prioridade: PrioridadeTarefa.P1,
                descricao: null,
                codigosResponsaveis: responsaveis.map((r) => r.codigo),
                quem: membro,
            });
            await avisarTarefaRecebida(tx, antes, t, membro.codigo);
            return t;
        });
    const avisos = (u: Usuario) => factory.criarAvisoRepository().listarDoUsuario(u.codigo);
    return { ...ctx, c, mk, criar, editar, avisos };
}

describe("aviso de tarefa recebida", () => {
    test("criar com [A, B] por A avisa só B, com o autor", async () => {
        const { membro, gerente, criar, avisos } = await cenario();
        const t = await criar([membro, gerente]);
        expect(await avisos(membro)).toHaveLength(0);
        const dele = await avisos(gerente);
        expect(dele).toHaveLength(1);
        expect(dele[0]).toMatchObject({ tipo: "tarefa_recebida", codigoTarefa: t.codigo, codigoAutor: membro.codigo });
    });

    test("editar [B] para [B, C] avisa só C; sem mudar, ninguém", async () => {
        const { gerente, c, criar, editar, avisos } = await cenario();
        const t = await criar([gerente]);
        const e = await editar(t, [gerente, c]);
        expect(await avisos(c)).toHaveLength(1);
        expect(await avisos(gerente)).toHaveLength(1);
        await editar(e, [gerente, c]);
        expect(await avisos(c)).toHaveLength(1);
        expect(await avisos(gerente)).toHaveLength(1);
    });

    test("tirar e pôr de novo com o aviso não lido continua um", async () => {
        const { gerente, c, criar, editar, avisos } = await cenario();
        const t = await criar([gerente, c]);
        const sem = await editar(t, [gerente]);
        await editar(sem, [gerente, c]);
        expect(await avisos(c)).toHaveLength(1);
    });
});

describe("aviso de capacitação nova", () => {
    test("avisa ativos com login na EJ menos o autor; inativo, convite pendente e ex-membro ficam de fora; editar não avisa", async () => {
        const { factory, membro, gerente, mk, c } = await cenario();
        const inativo = await mk("Ivo", "usr-ivo", StatusPessoa.INATIVO);
        const trainee = await mk("Tito", "usr-tito", StatusPessoa.TRAINEE);
        const convidado = await mk("Cida", "usr-cida", StatusPessoa.ATIVO, "");
        const gestao = { codigo: gerente.codigo, perfil: PerfilUsuario.DIRETOR } as any;
        const servico = new GerirCapacitacoes(factory);
        const ficha = await servico.salvar(gestao, {
            titulo: "Nova",
            data: new Date("2026-12-01T00:00:00.000Z"),
            hora: "18:00",
            codigoInstrutor: gerente.codigo,
            vagas: 5,
            tipo: "computacao",
            sala: "X",
        });
        const avisos = factory.criarAvisoRepository();
        expect(await avisos.listarDoUsuario(gerente.codigo)).toHaveLength(0);
        for (const u of [membro, c, trainee]) {
            expect(await avisos.listarDoUsuario(u.codigo)).toMatchObject([{ tipo: "capacitacao_nova", codigoCapacitacao: ficha.codigo }]);
        }
        expect(await avisos.listarDoUsuario(inativo.codigo)).toHaveLength(0);
        expect(await avisos.listarDoUsuario(convidado.codigo)).toHaveLength(0);
        await servico.salvar(gestao, { titulo: "Editada" }, ficha.codigo);
        expect(await avisos.listarDoUsuario(membro.codigo)).toHaveLength(1);
    });
});
