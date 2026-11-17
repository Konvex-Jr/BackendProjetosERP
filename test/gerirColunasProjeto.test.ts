import ColunaProjeto from "../source/domain/entity/ColunaProjeto";
import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import GerirColunasProjeto, { EntradaColuna } from "../source/useCases/projetos/GerirColunasProjeto";
import { ErroValidacao } from "../source/shared/erros/ErroValidacao";
import { criarContexto, dataFim, dataInicio } from "./fixtures";

const hoje = new Date("2026-11-16T00:00:00.000Z");

describe("GerirColunasProjeto", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let projeto: Projeto;
    let casoDeUso: GerirColunasProjeto;
    const porNome = (nome: string) => projeto.colunas.find((c) => c.nome === nome)!;
    const entrada = (c: ColunaProjeto): EntradaColuna => ({ codigo: c.codigo, nome: c.nome, cor: c.cor, papel: c.papel });
    const atuais = () => projeto.colunas.map(entrada);

    async function criarTarefa(titulo: string, coluna: ColunaProjeto) {
        // Nasce na entrada e vai para a coluna pelo domínio, que registra data e autor se for a concluída.
        const base = new Tarefa(
            projeto,
            titulo,
            dataInicio,
            dataFim,
            undefined,
            undefined,
            null,
            null,
            null,
            [ctx.membro],
            [],
            undefined,
            null,
            null,
            null,
            projeto.colunaDeEntrada,
        );
        return ctx.factory.criarTarefaRepository().criar(base.naColuna(coluna, new Date("2026-11-01T00:00:00.000Z"), ctx.gerente));
    }
    const executar = (colunas: unknown, destinos?: unknown) =>
        casoDeUso.execute({
            codigoProjeto: projeto.codigo,
            colunas: colunas as EntradaColuna[],
            destinos: destinos as any,
            hoje,
            quem: ctx.gerente,
        });
    async function erro(promessa: Promise<unknown>): Promise<string | undefined> {
        try {
            await promessa;
        } catch (e) {
            expect(e).toBeInstanceOf(ErroValidacao);
            return (e as ErroValidacao).codigo;
        }
        return undefined;
    }
    const projetoGravado = async () => (await ctx.factory.criarProjetoRepository().buscarPorCodigo(projeto.codigo))!;

    beforeEach(async () => {
        ctx = await criarContexto();
        projeto = await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("Projeto", "Descrição", dataInicio, dataFim, undefined, [ctx.membro], "proj-1"));
        casoDeUso = new GerirColunasProjeto(ctx.factory);
    });

    it("cria coluna nova no meio e devolve na ordem enviada", async () => {
        const lista = atuais();
        lista.splice(2, 0, { nome: "Testando", cor: "roxo", papel: "meio" });
        const gravadas = await executar(lista);
        expect(gravadas.map((c) => c.nome)).toEqual(["A fazer", "Fazendo", "Testando", "Revisando", "Concluído"]);
        expect(gravadas[2].codigo).toBeTruthy();
        expect((await projetoGravado()).colunas.map((c) => c.nome)).toEqual(gravadas.map((c) => c.nome));
    });

    it("renomeia, muda a cor e reordena mantendo os códigos", async () => {
        const [a, f, r, c] = atuais();
        const gravadas = await executar([c, { ...r, nome: "Em revisão", cor: "rosa" }, f, a]);
        expect(gravadas.map((x) => x.nome)).toEqual(["Concluído", "Em revisão", "Fazendo", "A fazer"]);
        expect(gravadas[1]).toMatchObject({ codigo: r.codigo, cor: "rosa" });
    });

    it("renomear atualiza o nome da coluna nas tarefas", async () => {
        const tarefa = await criarTarefa("T", porNome("Fazendo"));
        await executar(atuais().map((c) => (c.nome === "Fazendo" ? { ...c, nome: "Em curso" } : c)));
        expect((await ctx.factory.criarTarefaRepository().buscarPorCodigo(tarefa.codigo))!.coluna!.nome).toBe("Em curso");
    });

    it("exclui coluna vazia sem destino", async () => {
        const gravadas = await executar(atuais().filter((c) => c.nome !== "Revisando"));
        expect(gravadas.map((c) => c.nome)).toEqual(["A fazer", "Fazendo", "Concluído"]);
    });

    it("exclui coluna com tarefas: exige destino", async () => {
        await criarTarefa("T1", porNome("Revisando"));
        await criarTarefa("T2", porNome("Revisando"));
        const semRevisando = atuais().filter((c) => c.nome !== "Revisando");
        expect(await erro(executar(semRevisando))).toBe("DESTINO_COLUNA_OBRIGATORIO");
        await expect(executar(semRevisando)).rejects.toThrow(/Revisando.*2 tarefas/);
    });

    it("destino que é a própria coluna excluída ou não existe: DESTINO_COLUNA_INVALIDO", async () => {
        const revisando = porNome("Revisando");
        await criarTarefa("T1", revisando);
        const semRevisando = atuais().filter((c) => c.nome !== "Revisando");
        expect(await erro(executar(semRevisando, { [revisando.codigo]: revisando.codigo }))).toBe("DESTINO_COLUNA_INVALIDO");
        expect(await erro(executar(semRevisando, { [revisando.codigo]: "nao-existe" }))).toBe("DESTINO_COLUNA_INVALIDO");
    });

    it("exclui com destino e move as duas tarefas", async () => {
        const revisando = porNome("Revisando");
        const t1 = await criarTarefa("T1", revisando);
        const t2 = await criarTarefa("T2", revisando);
        await executar(
            atuais().filter((c) => c.nome !== "Revisando"),
            { [revisando.codigo]: porNome("Fazendo").codigo },
        );
        const repo = ctx.factory.criarTarefaRepository();
        for (const t of [t1, t2]) {
            const lida = (await repo.buscarPorCodigo(t.codigo))!;
            expect(lida.coluna!.nome).toBe("Fazendo");
            expect(lida.status).toBe(StatusTarefa.ANDAMENTO);
        }
    });

    it("mover tarefa para a coluna concluída registra data e autor", async () => {
        const revisando = porNome("Revisando");
        const t = await criarTarefa("T1", revisando);
        await executar(
            atuais().filter((c) => c.nome !== "Revisando"),
            { [revisando.codigo]: porNome("Concluído").codigo },
        );
        const lida = (await ctx.factory.criarTarefaRepository().buscarPorCodigo(t.codigo))!;
        expect(lida.status).toBe(StatusTarefa.CONCLUIDA);
        expect(lida.dataConclusao).toEqual(hoje);
        expect(lida.concluidaPor?.codigo).toBe(ctx.gerente.codigo);
    });

    it("trocar a coluna concluída acompanha o status das tarefas", async () => {
        const antiga = await criarTarefa("Pronta", porNome("Concluído"));
        const emRevisao = await criarTarefa("Em revisão", porNome("Revisando"));
        await executar(
            atuais().map((c) => {
                if (c.nome === "Concluído") return { ...c, papel: "meio" };
                if (c.nome === "Revisando") return { ...c, papel: "concluida" };
                return c;
            }),
        );
        const repo = ctx.factory.criarTarefaRepository();
        const nova = (await repo.buscarPorCodigo(emRevisao.codigo))!;
        expect(nova.status).toBe(StatusTarefa.CONCLUIDA);
        expect(nova.dataConclusao).toEqual(hoje);
        expect(nova.concluidaPor?.codigo).toBe(ctx.gerente.codigo);
        const velha = (await repo.buscarPorCodigo(antiga.codigo))!;
        expect(velha.status).toBe(StatusTarefa.ANDAMENTO);
        expect(velha.dataConclusao).toBeNull();
        expect(velha.concluidaPor).toBeNull();
    });

    it("erros do conjunto chegam como 400", async () => {
        const [a, f, r, c] = atuais();
        expect(await erro(executar([a]))).toBe("QUANTIDADE_COLUNAS_INVALIDA");
        expect(await erro(executar([a, { ...f, nome: "a fazer" }, c]))).toBe("NOME_COLUNA_REPETIDO");
        expect(await erro(executar([a, { ...f, papel: "entrada" }, r, c]))).toBe("COLUNA_ENTRADA_UNICA");
        expect(await erro(executar([a, f, { ...r, papel: "concluida" }, c]))).toBe("COLUNA_CONCLUIDA_UNICA");
        expect(await erro(executar([a, { ...f, nome: "  " }, c]))).toBe("NOME_COLUNA_INVALIDO");
        expect(await erro(executar([a, { ...f, cor: "preto" }, c]))).toBe("COR_COLUNA_INVALIDA");
        expect(await erro(executar([a, { ...f, papel: "x" }, c]))).toBe("PAPEL_COLUNA_INVALIDO");
    });

    it("código que não é texto: COLUNAS_INVALIDAS", async () => {
        const [a, f, , c] = atuais();
        expect(await erro(executar([a, { ...f, codigo: 7 }, c]))).toBe("COLUNAS_INVALIDAS");
    });

    it("código que não está mais nas colunas do projeto (excluída por outra pessoa, ou de outro projeto): 409 QUADRO_MUDOU", async () => {
        const outro = await ctx.factory
            .criarProjetoRepository()
            .criar(new Projeto("Outro", "Descrição", dataInicio, dataFim, undefined, [ctx.membro], "proj-2"));
        const [a, f, r, c] = atuais();
        // Outra pessoa excluiu "Revisando"; quem editava ainda manda o código dela.
        await executar([a, f, c]);
        for (const lista of [
            [a, f, r, c],
            [a, entrada(outro.colunas[1]), c],
        ]) {
            await expect(executar(lista)).rejects.toMatchObject({ codigo: "QUADRO_MUDOU", codigoHttp: 409 });
        }
        expect((await projetoGravado()).colunas.map((x) => x.nome)).toEqual(["A fazer", "Fazendo", "Concluído"]);
    });

    it("entrada que não é lista, item que não é objeto ou destinos que não é objeto: COLUNAS_INVALIDAS", async () => {
        expect(await erro(executar("x"))).toBe("COLUNAS_INVALIDAS");
        expect(await erro(executar(undefined))).toBe("COLUNAS_INVALIDAS");
        expect(await erro(executar([...atuais(), "x"]))).toBe("COLUNAS_INVALIDAS");
        expect(await erro(executar([...atuais(), null]))).toBe("COLUNAS_INVALIDAS");
        expect(await erro(executar(atuais(), "x"))).toBe("COLUNAS_INVALIDAS");
        expect(await erro(executar(atuais(), [1]))).toBe("COLUNAS_INVALIDAS");
    });

    it("código repetido na lista: COLUNAS_INVALIDAS", async () => {
        const [a, f, , c] = atuais();
        expect(await erro(executar([a, f, { ...f, nome: "Outra" }, c]))).toBe("COLUNAS_INVALIDAS");
    });
});
