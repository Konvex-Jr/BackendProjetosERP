import MarcarItemChecklist from "../source/useCases/tarefas/MarcarItemChecklist";
import EditarTarefa from "../source/useCases/tarefas/EditarTarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import { criarContexto, criarTarefa, dataInicio, dataFim } from "./fixtures";

const preparar = async () => {
    const { factory, membro } = await criarContexto();
    const tarefa = await criarTarefa(factory, membro);
    const comItem = await new EditarTarefa(factory).execute({
        codigo: tarefa.codigo,
        titulo: "Tarefa",
        dataInicio,
        dataFim,
        status: StatusTarefa.PENDENTE,
        prioridade: PrioridadeTarefa.P2,
        codigosResponsaveis: [membro.codigo],
        checklist: [{ texto: "A", feito: false }],
    } as never);
    return { factory, comItem };
};

test("marca e desmarca o item", async () => {
    const { factory, comItem } = await preparar();
    const item = comItem.checklist[0];
    const marcada = await new MarcarItemChecklist(factory).execute(comItem.codigo, item.codigo, true);
    expect(marcada.checklist[0].feito).toBe(true);
    const desmarcada = await new MarcarItemChecklist(factory).execute(comItem.codigo, item.codigo, false);
    expect(desmarcada.checklist[0].feito).toBe(false);
});

test("item que não é da tarefa: 404", async () => {
    const { factory, comItem } = await preparar();
    await expect(new MarcarItemChecklist(factory).execute(comItem.codigo, "outro-item", true)).rejects.toMatchObject({
        codigoHttp: 404,
    });
});

test("feito que não é booleano: 400 citando o campo", async () => {
    const { factory, comItem } = await preparar();
    await expect(
        new MarcarItemChecklist(factory).execute(comItem.codigo, comItem.checklist[0].codigo, "sim" as never),
    ).rejects.toMatchObject({ codigo: "FEITO_INVALIDO" });
});
