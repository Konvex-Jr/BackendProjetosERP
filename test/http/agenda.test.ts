import Projeto from "../../source/domain/entity/Projeto";
import Tarefa from "../../source/domain/entity/Tarefa";
import Usuario from "../../source/domain/entity/Usuario";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import PrioridadeTarefa from "../../source/domain/enum/PrioridadeTarefa";
import StatusPessoa from "../../source/domain/enum/StatusPessoa";
import StatusTarefa from "../../source/domain/enum/StatusTarefa";
import { criarContexto } from "../fixtures";
import { subirServidor } from "./servidorTeste";

const d = (texto: string) => new Date(`${texto}T00:00:00.000Z`);

/** Sessão 28b: agenda unificada (reuniões, prazos, capacitações) e reuniões. */
describe("Agenda e reuniões (HTTP)", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let bia: Usuario;
    let caio: Usuario;
    let oto: Usuario;

    const corpo = (extra: Record<string, unknown> = {}) => ({
        titulo: "Alinhamento",
        data: "2026-11-24",
        hora: "14:00",
        duracaoMinutos: 30,
        local: "https://meet.google.com/abc",
        participantes: ["usr-bia"],
        ...extra,
    });
    const agenda = (usuario: Usuario, consulta = "de=2026-11-01&ate=2026-11-30") =>
        servidor.chamar("get", `/agenda?${consulta}`, { usuario });

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const pessoa = async (nome: string, codigo: string, status = StatusPessoa.ATIVO) => {
            const u = new Usuario(nome, `${codigo}@konvex.com.br`, PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, codigo, { status });
            await usuarios.criar(u);
            return u;
        };
        bia = await pessoa("Bia", "usr-bia");
        caio = await pessoa("Caio", "usr-caio");
        oto = await pessoa("Oto", "usr-oto", StatusPessoa.INATIVO);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("sem login: 401", async () => {
        expect((await servidor.chamar("get", "/agenda?de=2026-11-01&ate=2026-11-30")).status).toBe(401);
        expect((await servidor.chamar("post", "/reunioes", { corpo: corpo() })).status).toBe(401);
    });

    it("qualquer pessoa cria; quem cria participa; só participantes e gestão veem; só quem criou e gestão alteram", async () => {
        const criada = await servidor.chamar("post", "/reunioes", { usuario: ctx.membro, corpo: corpo() });
        expect(criada.status).toBe(200);
        expect(criada.corpo).toMatchObject({
            titulo: "Alinhamento",
            data: "2026-11-24",
            hora: "14:00",
            duracaoMinutos: 30,
            podeAlterar: true,
        });
        expect(criada.corpo.participantes.map((p: any) => [p.codigo, p.email])).toEqual([
            ["usr-ana", "ana@konvex.com.br"],
            ["usr-bia", "usr-bia@konvex.com.br"],
        ]);
        const cod = criada.corpo.codigo;

        expect((await servidor.chamar("get", `/reunioes/${cod}`, { usuario: bia })).corpo.podeAlterar).toBe(false);
        expect((await servidor.chamar("get", `/reunioes/${cod}`, { usuario: caio })).status).toBe(404);
        expect((await servidor.chamar("put", `/reunioes/${cod}`, { usuario: caio, corpo: { titulo: "x" } })).status).toBe(404);
        expect((await servidor.chamar("put", `/reunioes/${cod}`, { usuario: bia, corpo: { titulo: "x" } })).status).toBe(403);
        expect((await servidor.chamar("get", `/reunioes/${cod}`, { usuario: ctx.gerente })).corpo.podeAlterar).toBe(true);

        // Quem criou não sai da lista; campo ausente mantém o valor.
        const editada = await servidor.chamar("put", `/reunioes/${cod}`, {
            usuario: ctx.membro,
            corpo: { hora: "15:30", participantes: ["usr-caio"] },
        });
        expect(editada.corpo).toMatchObject({ titulo: "Alinhamento", hora: "15:30" });
        expect(editada.corpo.participantes.map((p: any) => p.codigo).sort()).toEqual(["usr-ana", "usr-caio"]);
        expect((await servidor.chamar("get", `/reunioes/${cod}`, { usuario: bia })).status).toBe(404);

        expect((await servidor.chamar("delete", `/reunioes/${cod}`, { usuario: ctx.membro })).status).toBe(204);
        expect((await servidor.chamar("get", `/reunioes/${cod}`, { usuario: ctx.gerente })).status).toBe(404);
    });

    it("mensagens dizem o campo errado; inativo novo não entra", async () => {
        for (const [extra, codigo] of [
            [{ titulo: " " }, "TITULO_REUNIAO_OBRIGATORIO"],
            [{ data: "2026-02-30" }, "DATA_REUNIAO_INVALIDA"],
            [{ hora: "25:00" }, "HORA_REUNIAO_INVALIDA"],
            [{ duracaoMinutos: 2 }, "DURACAO_REUNIAO_INVALIDA"],
            [{ duracaoMinutos: "abc" }, "DURACAO_REUNIAO_INVALIDA"],
            [{ participantes: "usr-bia" }, "PARTICIPANTES_INVALIDOS"],
            [{ participantes: [oto.codigo] }, "PARTICIPANTE_INVALIDO"],
            [{ participantes: ["nao-existe"] }, "PARTICIPANTE_INVALIDO"],
        ] as const) {
            const r = await servidor.chamar("post", "/reunioes", { usuario: ctx.membro, corpo: corpo(extra) });
            expect([r.status, r.corpo.codigo]).toEqual([400, codigo]);
        }
    });

    it("agenda junta reuniões, prazos e capacitações; a gestão vê a de outra pessoa", async () => {
        await servidor.chamar("post", "/reunioes", { usuario: bia, corpo: corpo({ participantes: ["usr-ana"] }) });
        await servidor.chamar("post", "/reunioes", { usuario: bia, corpo: corpo({ titulo: "Só Bia", participantes: [] }) });
        await servidor.chamar("post", "/reunioes", {
            usuario: bia,
            corpo: corpo({ titulo: "Dezembro", data: "2026-12-02", participantes: ["usr-ana"] }),
        });

        const projetos = ctx.factory.criarProjetoRepository();
        const normal = await projetos.criar(new Projeto("Normal", "d", d("2026-10-01"), d("2026-12-31"), undefined, [ctx.membro], "p-nor"));
        const sigiloso = await projetos.criar(
            new Projeto("Secreto", "d", d("2026-10-01"), d("2026-12-31"), undefined, [ctx.membro], "p-sig", { sigiloso: true }),
        );
        const tarefa = (projeto: Projeto, titulo: string, codigo: string, fim: string, status = StatusTarefa.PENDENTE) =>
            new Tarefa(
                projeto,
                titulo,
                d("2026-11-01"),
                d(fim),
                status,
                PrioridadeTarefa.P2,
                null,
                status === StatusTarefa.CONCLUIDA ? d(fim) : null,
                null,
                [ctx.membro],
                [],
                codigo,
            );
        const tarefas = ctx.factory.criarTarefaRepository();
        await tarefas.criar(tarefa(normal, "Relatório", "t-1", "2026-11-10"));
        await tarefas.criar(tarefa(sigiloso, "Segredo", "t-2", "2026-11-12"));
        await tarefas.criar(tarefa(normal, "Fora do mês", "t-3", "2026-12-10"));

        const minha = await agenda(ctx.membro);
        expect(minha.status).toBe(200);
        expect(minha.corpo.pessoa).toEqual({ codigo: "usr-ana", nome: "Ana Silva" });
        expect(minha.corpo.itens.map((i: any) => [i.tipo, i.data, i.titulo])).toEqual([
            ["prazo", "2026-11-10", "Relatório"],
            ["prazo", "2026-11-12", "Segredo"],
            ["capacitacao", "2026-11-20", "DDD e Clean Architecture"],
            ["reuniao", "2026-11-24", "Alinhamento"],
        ]);
        expect(minha.corpo.itens[0]).toMatchObject({ codigo: "t-1", projeto: { codigo: "p-nor", nome: "Normal" }, concluida: false });
        expect(minha.corpo.itens[2]).toMatchObject({ inscrito: false, ministra: false });

        // Gerente vê a agenda de Ana; o prazo do sigiloso fica sem título.
        const doGerente = await agenda(ctx.gerente, "de=2026-11-01&ate=2026-11-30&pessoa=usr-ana");
        const segredo = doGerente.corpo.itens.find((i: any) => i.data === "2026-11-12");
        expect(segredo).toMatchObject({ tipo: "prazo", codigo: null, titulo: null, projeto: { nome: "Secreto" } });
        expect(doGerente.corpo.itens.find((i: any) => i.tipo === "capacitacao").ministra).toBe(false);
        expect((await agenda(ctx.gerente)).corpo.itens.find((i: any) => i.tipo === "capacitacao").ministra).toBe(true);

        expect((await agenda(ctx.membro, "de=2026-11-01&ate=2026-11-30&pessoa=usr-bia")).status).toBe(403);
        expect((await agenda(ctx.gerente, "de=2026-11-01&ate=2026-11-30&pessoa=nao-existe")).status).toBe(404);
        for (const consulta of [
            "de=2026-11-30&ate=2026-11-01",
            "de=2026-11-01&ate=2027-02-01",
            "de=2026-11-01",
            "de=ontem&ate=2026-11-30",
        ]) {
            const r = await agenda(ctx.membro, consulta);
            expect([r.status, r.corpo.codigo]).toEqual([400, "AGENDA_PERIODO_INVALIDO"]);
        }
    });
});
