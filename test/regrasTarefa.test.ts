import Usuario from "../source/domain/entity/Usuario";
import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import { regrasTarefa } from "../source/shared/seguranca/regrasTarefa";
import { criarContexto, dataFim, dataInicio } from "./fixtures";
import { autenticado, comPapel } from "./papel";

describe("regrasTarefa.editar (sessão 24b)", () => {
    const auth = (u: Usuario) => autenticado(u);

    async function montar(opcoes: Record<string, never> = {}) {
        const { senioridade, membro, gerente } = await criarContexto();
        const criador = comPapel(new Usuario("Bruno", "bruno@konvex.com.br", true, "x", senioridade, "usr-bruno"), "membro");
        const projeto = new Projeto("Time", "d", dataInicio, dataFim, undefined, [membro, criador], "proj-time", opcoes);
        const tarefa = (criadaPor: Usuario | null) =>
            new Tarefa(projeto, "T", dataInicio, dataFim, undefined, undefined, null, null, null, [membro], [], "t-1", null, criadaPor);
        return { membro, gerente, criador, projeto, tarefa };
    }

    it("participante que criou edita, mas não organiza", async () => {
        const { criador, projeto, tarefa } = await montar();
        const r = regrasTarefa(auth(criador), tarefa(criador), projeto);
        expect(r.editar).toBe(true);
        expect(r.organizar).toBe(false);
    });

    it("participante que não criou não edita", async () => {
        const { membro, criador, projeto, tarefa } = await montar();
        expect(regrasTarefa(auth(membro), tarefa(criador), projeto).editar).toBe(false);
    });

    it("criador que saiu da equipe não edita", async () => {
        const { criador, projeto, tarefa } = await montar();
        const sem = new Projeto("Time", "d", dataInicio, dataFim, undefined, [], "proj-time");
        expect(regrasTarefa(auth(criador), tarefa(criador), sem).editar).toBe(false);
        expect(projeto.membros).toHaveLength(2);
    });

    it("tarefa sem criador: só gestão edita", async () => {
        const { membro, gerente, criador, projeto, tarefa } = await montar();
        expect(regrasTarefa(auth(criador), tarefa(null), projeto).editar).toBe(false);
        expect(regrasTarefa(auth(membro), tarefa(null), projeto).editar).toBe(false);
        expect(regrasTarefa(auth(gerente), tarefa(null), projeto).editar).toBe(true);
    });

    it("sigiloso sem acesso completo: não edita", async () => {
        const { criador, tarefa } = await montar();
        const sig = new Projeto("Sig", "d", dataInicio, dataFim, undefined, [], "proj-time", {});
        expect(regrasTarefa(auth(criador), tarefa(criador), sig).editar).toBe(false);
    });
});
