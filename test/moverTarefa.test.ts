import MoverTarefa from "../source/useCases/tarefas/MoverTarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import Projeto from "../source/domain/entity/Projeto";
import { criarContexto, criarProjeto, criarTarefa, dataInicio, dataFim } from "./fixtures";

const HOJE = new Date("2026-11-16T00:00:00.000Z");

async function preparar() {
    const ctx = await criarContexto();
    const projeto = await criarProjeto(ctx.factory, ctx.membro);
    const tarefa = await criarTarefa(ctx.factory, ctx.membro, projeto);
    const coluna = (nome: string) => projeto.colunas.find((c) => c.nome === nome)!;
    const mover = (nome: string, quem = ctx.membro) => new MoverTarefa(ctx.factory).execute(tarefa.codigo, coluna(nome).codigo, HOJE, quem);
    return { ...ctx, projeto, tarefa, coluna, mover };
}

describe("MoverTarefa", () => {
    it("A fazer para Revisando: andamento, sem data", async () => {
        const { mover } = await preparar();
        const t = await mover("Revisando");
        expect(t.coluna!.nome).toBe("Revisando");
        expect(t.status).toBe(StatusTarefa.ANDAMENTO);
        expect(t.dataConclusao).toBeNull();
    });

    it("para Concluído: concluída com hoje e quem moveu", async () => {
        const { mover, membro } = await preparar();
        const t = await mover("Concluído");
        expect(t.status).toBe(StatusTarefa.CONCLUIDA);
        expect(t.dataConclusao).toEqual(HOJE);
        expect(t.concluidaPor?.codigo).toBe(membro.codigo);
    });

    it("Concluído para Concluído mantém data e autor", async () => {
        const { mover, gerente, membro } = await preparar();
        await mover("Concluído");
        const outro = await mover("Concluído", gerente);
        expect(outro.dataConclusao).toEqual(HOJE);
        expect(outro.concluidaPor?.codigo).toBe(membro.codigo);
    });

    it("Concluído para Fazendo apaga data e autor", async () => {
        const { mover } = await preparar();
        await mover("Concluído");
        const t = await mover("Fazendo");
        expect(t.status).toBe(StatusTarefa.ANDAMENTO);
        expect(t.dataConclusao).toBeNull();
        expect(t.concluidaPor).toBeNull();
    });

    it("coluna de outro projeto e código inexistente: COLUNA_DE_OUTRO_PROJETO", async () => {
        const { factory, tarefa, membro } = await preparar();
        const outro = await factory
            .criarProjetoRepository()
            .criar(new Projeto("Outro", "d", dataInicio, dataFim, undefined, [membro], "outro-projeto"));
        const mover = (codigoColuna: string) => new MoverTarefa(factory).execute(tarefa.codigo, codigoColuna, HOJE, membro);
        await expect(mover(outro.colunas[1].codigo)).rejects.toMatchObject({ codigo: "COLUNA_DE_OUTRO_PROJETO" });
        await expect(mover("nao-existe")).rejects.toMatchObject({ codigo: "COLUNA_DE_OUTRO_PROJETO" });
        await expect(mover(undefined as unknown as string)).rejects.toMatchObject({ codigo: "COLUNA_DE_OUTRO_PROJETO" });
    });
});
