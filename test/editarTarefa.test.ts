import EditarTarefa from "../source/useCases/tarefas/EditarTarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import { criarContexto, criarTarefa, dataInicio, dataFim } from "./fixtures";

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
