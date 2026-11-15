import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import { resumoProjeto } from "../source/useCases/projetos/resumoProjeto";
import { fimDaSemana } from "../source/shared/datas";
import { criarContexto, dataFim, dataInicio } from "./fixtures";

describe("resumoProjeto", () => {
    it("tem só os campos permitidos e nada do cliente", async () => {
        const { membro } = await criarContexto();
        const projeto = new Projeto("Sigiloso", "descrição secreta", dataInicio, dataFim, undefined, [membro], "p-1", {
            sigiloso: true,
            clienteNome: "Cliente Secreto",
            referencia: "REF-77",
        });
        const resumo = resumoProjeto(projeto, { total: 2, concluidas: 1, atrasadas: 0, semana: 1 });
        expect(Object.keys(resumo).sort()).toEqual(
            ["codigo", "dataFim", "dataInicio", "nome", "participacoes", "resumo", "sigiloso", "status", "tarefas"].sort(),
        );
        expect(resumo.resumo).toBe(true);
        expect(resumo.sigiloso).toBe(true);
        expect(Object.keys(resumo.participacoes[0]).sort()).toEqual(["alocacao", "ativa", "dataEntrada", "dataSaida", "usuario"]);
        expect(Object.keys(resumo.participacoes[0].usuario).sort()).toEqual(["codigo", "nome"]);
        const json = JSON.stringify(resumo);
        for (const proibido of ["clienteNome", "Cliente Secreto", "descricao", "descrição secreta", "referencia", "REF-77", "funcao"]) {
            expect(json).not.toContain(proibido);
        }
    });
});

describe("fimDaSemana", () => {
    it("devolve o domingo da semana de segunda a domingo", () => {
        expect(fimDaSemana(new Date("2026-11-18T00:00:00.000Z")).toISOString()).toBe("2026-11-22T00:00:00.000Z");
        expect(fimDaSemana(new Date("2026-11-22T00:00:00.000Z")).toISOString()).toBe("2026-11-22T00:00:00.000Z");
        expect(fimDaSemana(new Date("2026-11-16T00:00:00.000Z")).toISOString()).toBe("2026-11-22T00:00:00.000Z");
    });
});

describe("contarPorProjetos (memória)", () => {
    it("conta total, concluídas, atrasadas e da semana", async () => {
        const { factory, membro } = await criarContexto();
        const projeto = await factory
            .criarProjetoRepository()
            .criar(new Projeto("P", "d", dataInicio, dataFim, undefined, [membro], "p-1"));
        const tarefas = factory.criarTarefaRepository();
        const nova = (titulo: string, fim: string, status: StatusTarefa) =>
            tarefas.criar(
                new Tarefa(
                    projeto,
                    titulo,
                    dataInicio,
                    new Date(`${fim}T00:00:00.000Z`),
                    status,
                    PrioridadeTarefa.P2,
                    null,
                    status === StatusTarefa.CONCLUIDA ? dataFim : null,
                    null,
                    [membro],
                    [],
                ),
            );
        await nova("a", "2026-11-17", StatusTarefa.PENDENTE);
        await nova("b", "2026-11-22", StatusTarefa.PENDENTE);
        await nova("c", "2026-11-23", StatusTarefa.PENDENTE);
        await nova("d", "2026-11-10", StatusTarefa.CONCLUIDA);
        const mapa = await tarefas.contarPorProjetos(["p-1", "vazio"], new Date("2026-11-18T00:00:00.000Z"));
        expect(mapa.get("p-1")).toEqual({ total: 4, concluidas: 1, atrasadas: 1, semana: 1 });
        expect(mapa.get("vazio")).toEqual({ total: 0, concluidas: 0, atrasadas: 0, semana: 0 });
    });
});
