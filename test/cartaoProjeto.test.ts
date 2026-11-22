import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import { cartaoProjeto } from "../source/useCases/projetos/cartaoProjeto";
import Area from "../source/domain/entity/Area";
import TipoProjeto from "../source/domain/enum/TipoProjeto";
import { fimDaSemana } from "../source/shared/datas";
import { criarContexto, dataFim, dataInicio } from "./fixtures";

describe("cartaoProjeto", () => {
    const chaves = ["area", "cartao", "codigo", "geralDaArea", "lider", "membros", "nome", "sigiloso", "status", "tipo"];

    it("tem só os campos da lista fechada e nada do cliente, das datas ou das funções", async () => {
        const { membro } = await criarContexto();
        const area = new Area("Projetos", null, true, "area-1");
        const projeto = new Projeto("Sigiloso", "descrição secreta", dataInicio, dataFim, undefined, [membro], "p-1", {
            sigiloso: true,
            clienteNome: "Cliente Secreto",
            referencia: "REF-77",
            area,
            lider: membro,
        });
        const cartao = cartaoProjeto(projeto);
        expect(Object.keys(cartao).sort()).toEqual(chaves);
        expect(cartao.cartao).toBe(true);
        expect(cartao.sigiloso).toBe(true);
        expect(cartao.tipo).toBe("cliente");
        expect(cartao.geralDaArea).toBe(false);
        expect(cartao.membros).toEqual([{ codigo: membro.codigo, nome: membro.nome, foto: null }]);
        const json = JSON.stringify(cartao);
        for (const proibido of [
            "clienteNome",
            "Cliente Secreto",
            "descricao",
            "descrição secreta",
            "referencia",
            "REF-77",
            "dataInicio",
            "dataFim",
            "participacoes",
            "funcao",
            "tarefas",
            "colunas",
            membro.email,
        ]) {
            expect(json).not.toContain(proibido);
        }
    });

    it("projeto cliente com área: área nula", () => {
        const area = new Area("Projetos", null, true, "area-1");
        const projeto = new Projeto("Cliente", "d", dataInicio, dataFim, undefined, [], "p-1", { area });
        expect(cartaoProjeto(projeto).area).toBeNull();
    });

    it("projeto interno: área com código e nome", () => {
        const area = new Area("Projetos", null, true, "area-1");
        const projeto = new Projeto("Interno", "d", dataInicio, dataFim, undefined, [], "p-1", { area, tipo: TipoProjeto.INTERNO });
        expect(cartaoProjeto(projeto).area).toEqual({ codigo: "area-1", nome: "Projetos" });
    });

    it("sem líder: líder nulo; com líder: só código e nome", async () => {
        const { membro } = await criarContexto();
        const semLider = new Projeto("P", "d", dataInicio, dataFim, undefined, [membro], "p-1");
        expect(cartaoProjeto(semLider).lider).toBeNull();
        const comLider = semLider.copiar({ lider: membro });
        expect(cartaoProjeto(comLider).lider).toEqual({ codigo: membro.codigo, nome: membro.nome });
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
