import CorrigirConclusao from "../source/useCases/tarefas/CorrigirConclusao";
import MoverTarefa from "../source/useCases/tarefas/MoverTarefa";
import { criarContexto, criarProjeto, criarTarefa } from "./fixtures";

const HOJE = new Date("2026-11-19T00:00:00.000Z");

async function preparar() {
    const ctx = await criarContexto();
    const projeto = await criarProjeto(ctx.factory, ctx.membro);
    const tarefa = await criarTarefa(ctx.factory, ctx.membro, projeto);
    const concluir = () =>
        new MoverTarefa(ctx.factory).execute(tarefa.codigo, projeto.colunas.find((c) => c.nome === "Concluído")!.codigo, HOJE, ctx.membro);
    const corrigir = (data: string) => new CorrigirConclusao(ctx.factory).execute(tarefa.codigo, new Date(`${data}T00:00:00.000Z`), HOJE);
    return { ...ctx, tarefa, concluir, corrigir };
}

describe("CorrigirConclusao", () => {
    it("troca a data e mantém quem concluiu", async () => {
        const { concluir, corrigir, membro } = await preparar();
        await concluir();
        const t = await corrigir("2026-11-12");
        expect(t.dataConclusao).toEqual(new Date("2026-11-12T00:00:00.000Z"));
        expect(t.concluidaPor?.codigo).toBe(membro.codigo);
    });

    it("aceita hoje e o dia do início", async () => {
        const { concluir, corrigir } = await preparar();
        await concluir();
        expect((await corrigir("2026-11-19")).dataConclusao).toEqual(HOJE);
        expect((await corrigir("2026-10-12")).dataConclusao).toEqual(new Date("2026-10-12T00:00:00.000Z"));
    });

    it("data no futuro: 400 DATA_CONCLUSAO_FUTURA", async () => {
        const { concluir, corrigir } = await preparar();
        await concluir();
        await expect(corrigir("2026-11-20")).rejects.toMatchObject({ codigo: "DATA_CONCLUSAO_FUTURA" });
    });

    it("data antes do início: 400 DATA_CONCLUSAO_ANTES_DO_INICIO", async () => {
        const { concluir, corrigir } = await preparar();
        await concluir();
        await expect(corrigir("2026-10-11")).rejects.toMatchObject({ codigo: "DATA_CONCLUSAO_ANTES_DO_INICIO" });
    });

    it("tarefa pendente: 400 TAREFA_NAO_CONCLUIDA", async () => {
        const { corrigir } = await preparar();
        await expect(corrigir("2026-11-12")).rejects.toMatchObject({ codigo: "TAREFA_NAO_CONCLUIDA" });
    });

    it("tarefa inexistente: 404", async () => {
        const { factory } = await preparar();
        await expect(new CorrigirConclusao(factory).execute("nao-existe", HOJE, HOJE)).rejects.toThrow("Tarefa não encontrada.");
    });
});
