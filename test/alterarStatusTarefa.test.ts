import AlterarStatusTarefa from "../source/useCases/tarefas/AlterarStatusTarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import MoverTarefa from "../source/useCases/tarefas/MoverTarefa";
import { criarContexto, criarProjeto, criarTarefa } from "./fixtures";

test("altera o status e registra a data de conclusão da tarefa", async () => {
    const { factory, membro } = await criarContexto();
    const tarefa = await criarTarefa(factory, membro);
    const dataConclusao = new Date("2026-10-20T00:00:00.000Z");

    const atualizada = await new AlterarStatusTarefa(factory).execute(tarefa.codigo, StatusTarefa.CONCLUIDA, dataConclusao);

    expect(atualizada.status).toBe(StatusTarefa.CONCLUIDA);
    expect(atualizada.dataConclusao).toEqual(dataConclusao);
});

describe("status em tarefa de projeto com colunas", () => {
    const preparar = async () => {
        const ctx = await criarContexto();
        const projeto = await criarProjeto(ctx.factory, ctx.membro);
        const tarefa = await criarTarefa(ctx.factory, ctx.membro, projeto);
        const coluna = (nome: string) => projeto.colunas.find((c) => c.nome === nome)!;
        const mover = (nome: string) => new MoverTarefa(ctx.factory).execute(tarefa.codigo, coluna(nome).codigo, hoje, ctx.membro);
        const alterar = (status: StatusTarefa) => new AlterarStatusTarefa(ctx.factory).execute(tarefa.codigo, status, hoje, ctx.membro);
        return { ...ctx, projeto, tarefa, mover, alterar };
    };
    const hoje = new Date("2026-11-16T00:00:00.000Z");

    it("em Revisando, andamento fica em Revisando", async () => {
        const { mover, alterar } = await preparar();
        await mover("Revisando");
        expect((await alterar(StatusTarefa.ANDAMENTO)).coluna!.nome).toBe("Revisando");
    });

    it("em Concluído, andamento vai para Fazendo e pendente para A fazer", async () => {
        const { mover, alterar } = await preparar();
        await mover("Concluído");
        const reaberta = await alterar(StatusTarefa.ANDAMENTO);
        expect(reaberta.coluna!.nome).toBe("Fazendo");
        expect(reaberta.dataConclusao).toBeNull();
        await mover("Concluído");
        expect((await alterar(StatusTarefa.PENDENTE)).coluna!.nome).toBe("A fazer");
    });

    it("projeto só com entrada e concluída: andamento vai para a entrada, com status pendente", async () => {
        const { projeto, factory, tarefa, membro } = await preparar();
        const [a, , , c] = projeto.colunas;
        await factory.criarColunaProjetoRepository().substituir(projeto.codigo, [a, c], new Map(), hoje, membro);
        const projetoAtual = projeto.comColunas([a, c]);
        await factory.criarProjetoRepository().editar(projetoAtual);
        const t = await new AlterarStatusTarefa(factory).execute(tarefa.codigo, StatusTarefa.ANDAMENTO, hoje, membro);
        expect(t.coluna!.nome).toBe("A fazer");
        expect(t.status).toBe(StatusTarefa.PENDENTE);
    });
});
