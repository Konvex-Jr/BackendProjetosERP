import EditarTarefa from "../source/useCases/tarefas/EditarTarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import { criarContexto, criarTarefa, dataInicio, dataFim } from "./fixtures";
import Projeto from "../source/domain/entity/Projeto";

test("edita os dados de uma tarefa existente", async () => {
    const { factory, membro } = await criarContexto();
    const tarefa = await criarTarefa(factory, membro);

    const atualizada = await new EditarTarefa(factory).execute({
        codigo: tarefa.codigo,
        titulo: "Tarefa Atualizada",
        dataInicio,
        dataFim,
        status: StatusTarefa.PENDENTE,
        prioridade: PrioridadeTarefa.P1,
        codigosResponsaveis: [membro.codigo],
    });

    expect(atualizada.titulo).toBe("Tarefa Atualizada");
    expect(atualizada.prioridade).toBe(PrioridadeTarefa.P1);
});

describe("colunas na edição", () => {
    const editar = async (extra: object) => {
        const { factory, membro } = await criarContexto();
        const tarefa = await criarTarefa(factory, membro);
        const coluna = (nome: string) => tarefa.projeto!.colunas.find((c) => c.nome === nome)!;
        const resultado = await new EditarTarefa(factory).execute({
            codigo: tarefa.codigo,
            titulo: "Tarefa",
            dataInicio,
            dataFim,
            status: StatusTarefa.PENDENTE,
            prioridade: PrioridadeTarefa.P2,
            codigosResponsaveis: [membro.codigo],
            quem: membro,
            ...extra,
        } as never);
        return { resultado, coluna };
    };

    it("codigoColuna vence status", async () => {
        const { factory, membro } = await criarContexto();
        const tarefa = await criarTarefa(factory, membro);
        const revisando = tarefa.projeto!.colunas.find((c) => c.nome === "Revisando")!;
        const t = await new EditarTarefa(factory).execute({
            codigo: tarefa.codigo,
            titulo: "Tarefa",
            dataInicio,
            dataFim,
            status: StatusTarefa.CONCLUIDA,
            codigoColuna: revisando.codigo,
            prioridade: PrioridadeTarefa.P2,
            codigosResponsaveis: [membro.codigo],
            quem: membro,
        });
        expect(t.coluna!.nome).toBe("Revisando");
        expect(t.status).toBe(StatusTarefa.ANDAMENTO);
        expect(t.dataConclusao).toBeNull();
    });

    it("sem codigoColuna, status concluida leva à coluna concluída", async () => {
        const { resultado } = await editar({ status: StatusTarefa.CONCLUIDA });
        expect(resultado.coluna!.nome).toBe("Concluído");
        expect(resultado.dataConclusao).not.toBeNull();
    });

    it("coluna inexistente: COLUNA_DE_OUTRO_PROJETO", async () => {
        await expect(editar({ codigoColuna: "nao-existe" })).rejects.toMatchObject({ codigo: "COLUNA_DE_OUTRO_PROJETO" });
    });
});

describe("dificuldade na edição", () => {
    const editar = async (extra: object, inicial: string | null = "facil") => {
        const { factory, membro } = await criarContexto();
        const tarefa = await criarTarefa(factory, membro);
        const base = {
            codigo: tarefa.codigo,
            titulo: "Tarefa",
            dataInicio,
            dataFim,
            status: StatusTarefa.PENDENTE,
            prioridade: PrioridadeTarefa.P2,
            codigosResponsaveis: [membro.codigo],
        };
        await new EditarTarefa(factory).execute({ ...base, dificuldade: inicial } as never);
        return new EditarTarefa(factory).execute({ ...base, ...extra } as never);
    };

    it("troca a dificuldade", async () => {
        expect((await editar({ dificuldade: "dificil" })).dificuldade).toBe("dificil");
    });

    it("null limpa", async () => {
        expect((await editar({ dificuldade: null })).dificuldade).toBeNull();
    });

    it("sem o campo mantém", async () => {
        expect((await editar({})).dificuldade).toBe("facil");
    });

    it("valor inválido: 400 DIFICULDADE_INVALIDA", async () => {
        await expect(editar({ dificuldade: "enorme" })).rejects.toMatchObject({ codigo: "DIFICULDADE_INVALIDA" });
    });
});

describe("checklist na edição (sessão 24b)", () => {
    const preparar = async () => {
        const { factory, membro, gerente } = await criarContexto();
        const tarefa = await criarTarefa(factory, membro);
        // O gerente entra na equipe e na tarefa para poder ser responsável de itens.
        const projeto = (await factory.criarProjetoRepository().buscarPorCodigo(tarefa.projeto.codigo))!;
        await factory
            .criarProjetoRepository()
            .editar(
                new Projeto(
                    projeto.nome,
                    projeto.descricao,
                    projeto.dataInicio,
                    projeto.dataFim,
                    undefined,
                    [membro, gerente],
                    projeto.codigo,
                ),
            );
        const editar = (extra: object) =>
            new EditarTarefa(factory).execute({
                codigo: tarefa.codigo,
                titulo: "Tarefa",
                dataInicio,
                dataFim,
                status: StatusTarefa.PENDENTE,
                prioridade: PrioridadeTarefa.P2,
                codigosResponsaveis: [membro.codigo, gerente.codigo],
                ...extra,
            } as never);
        return { factory, membro, gerente, tarefa, editar };
    };

    it("responsável do item fora da tarefa: 400 RESPONSAVEL_ITEM_FORA_DA_TAREFA", async () => {
        const { membro, gerente, editar } = await preparar();
        await expect(
            editar({ codigosResponsaveis: [membro.codigo], checklist: [{ texto: "A", feito: false, codigoResponsavel: gerente.codigo }] }),
        ).rejects.toMatchObject({ codigo: "RESPONSAVEL_ITEM_FORA_DA_TAREFA" });
    });

    it("grava o responsável do item", async () => {
        const { gerente, editar } = await preparar();
        const r = await editar({ checklist: [{ texto: "A", feito: false, codigoResponsavel: gerente.codigo }] });
        expect(r.checklist[0].responsavel?.codigo).toBe(gerente.codigo);
    });

    it("tirar o responsável da tarefa limpa os itens dele, sem erro", async () => {
        const { membro, gerente, editar } = await preparar();
        const com = await editar({ checklist: [{ texto: "A", feito: false, codigoResponsavel: gerente.codigo }] });
        const item = com.checklist[0];
        const sem = await editar({
            codigosResponsaveis: [membro.codigo],
            checklist: [{ codigo: item.codigo, texto: "A", feito: false, codigoResponsavel: gerente.codigo }],
        });
        expect(sem.checklist).toHaveLength(1);
        expect(sem.checklist[0].responsavel).toBeNull();
    });

    it("sem checklist no corpo, tirar o responsável também limpa os itens", async () => {
        const { membro, gerente, editar } = await preparar();
        await editar({ checklist: [{ texto: "A", feito: false, codigoResponsavel: gerente.codigo }] });
        const sem = await editar({ codigosResponsaveis: [membro.codigo] });
        expect(sem.checklist[0].responsavel).toBeNull();
    });

    it("item que já existe feito no banco continua feito mesmo com feito false no corpo", async () => {
        const { factory, tarefa, editar } = await preparar();
        const criada = await editar({ checklist: [{ texto: "A", feito: false }] });
        await factory.criarTarefaRepository().marcarItem(tarefa.codigo, criada.checklist[0].codigo, true);
        const r = await editar({ checklist: [{ codigo: criada.checklist[0].codigo, texto: "A editado", feito: false }] });
        expect(r.checklist[0].feito).toBe(true);
        expect(r.checklist[0].texto).toBe("A editado");
    });

    it("item novo com feito true no corpo nasce não feito; código desconhecido vira novo", async () => {
        const { editar } = await preparar();
        const r = await editar({ checklist: [{ codigo: "inventado", texto: "N", feito: true }] });
        expect(r.checklist[0].feito).toBe(false);
        expect(r.checklist[0].codigo).not.toBe("inventado");
    });
});
