import Participacao from "../source/domain/entity/Participacao";
import Projeto from "../source/domain/entity/Projeto";
import Usuario from "../source/domain/entity/Usuario";
import Tarefa from "../source/domain/entity/Tarefa";
import DificuldadeTarefa from "../source/domain/enum/DificuldadeTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import { hoje } from "../source/shared/datas";
import ObterPerfilPessoa from "../source/useCases/pessoas/ObterPerfilPessoa";
import { criarContexto, dataFim, dataInicio } from "./fixtures";
import { autenticado, comPapel } from "./papel";

const saida = new Date("2026-10-20T00:00:00.000Z");

async function montar() {
    const { factory, membro, gerente, senioridade } = await criarContexto();
    const outro = comPapel(new Usuario("Beto Lima", "beto@konvex.com.br", true, "senha-hash", senioridade, "usr-beto"), "membro");
    await factory.criarUsuarioRepository().criar(outro);
    const repo = factory.criarProjetoRepository();
    const detalhes = { referencia: "REF-SECRETA" };
    // Ana (membro) e Beto estão no normal e no sigiloso; Ana saiu do sigiloso "antigo".
    await repo.criar(new Projeto("Normal", "d", dataInicio, dataFim, undefined, [membro, outro], "p-normal", detalhes));
    await repo.criar(new Projeto("Sigiloso ativo", "d", dataInicio, dataFim, undefined, [membro, outro], "p-sig", { ...detalhes }));
    await repo.criar(
        new Projeto(
            "Sigiloso antigo",
            "d",
            dataInicio,
            dataFim,
            undefined,
            [new Participacao(membro, { dataEntrada: dataInicio, dataSaida: saida }), outro],
            "p-sig-antigo",
            { ...detalhes },
        ),
    );
    const auth = (u: Usuario) => autenticado(u);
    return { factory, membro, gerente, outro, auth };
}

describe("Perfil da pessoa com projetos fechados (31a: era o sigiloso)", () => {
    it("gerente de outra área vê todos; os que não abre vêm restritos, sem referência nem função", async () => {
        const { factory, membro, auth } = await montar();
        const gerenteFora = comPapel(new Usuario("Gui", "gui@konvex.com.br", true, "x", membro.senioridade, "usr-gui"), "gerenteDaArea");
        const perfil = await new ObterPerfilPessoa(factory).execute(membro.codigo, auth(gerenteFora));
        const todos = [...perfil.projetosAtuais, ...perfil.projetosAnteriores];
        expect(todos.map((p) => p.codigo).sort()).toEqual(["p-normal", "p-sig", "p-sig-antigo"]);
        const sig = todos.find((p) => p.codigo === "p-sig")!;
        expect(sig).toMatchObject({ nome: "Sigiloso ativo", restrito: true, referencia: null, funcao: null });
        expect(JSON.stringify(sig)).not.toContain("REF-SECRETA");
    });

    it("gestão que abre todos vê tudo completo", async () => {
        const { factory, membro, gerente, auth } = await montar();
        const perfil = await new ObterPerfilPessoa(factory).execute(membro.codigo, auth(gerente));
        const todos = [...perfil.projetosAtuais, ...perfil.projetosAnteriores];
        expect(todos.every((p) => !p.restrito)).toBe(true);
    });

    it("a própria pessoa vê completo também o projeto de que saiu (quem sai não perde o acesso)", async () => {
        const { factory, membro, auth } = await montar();
        const perfil = await new ObterPerfilPessoa(factory).execute(membro.codigo, auth(membro));
        const antigo = [...perfil.projetosAtuais, ...perfil.projetosAnteriores].find((p) => p.codigo === "p-sig-antigo")!;
        expect(antigo).toMatchObject({ restrito: false, referencia: "REF-SECRETA" });
    });

    it("membro olhando outro: projeto que ele também abre (até de que saiu) vem completo (sessão 27b)", async () => {
        const { factory, membro, outro, auth } = await montar();
        const perfil = await new ObterPerfilPessoa(factory).execute(outro.codigo, auth(membro));
        const todos = [...perfil.projetosAtuais, ...perfil.projetosAnteriores];
        expect(todos.map((p) => [p.codigo, p.restrito]).sort()).toEqual([
            ["p-normal", false],
            ["p-sig", false],
            ["p-sig-antigo", false],
        ]);
        expect(perfil.ocupacao).toMatchObject({ percentual: 0, horas: 0, itens: [] });
        expect("alocacao" in perfil).toBe(false);
    });

    it("membro não vê a passagem antiga de outra pessoa por projeto que não vê completo (como no cartão)", async () => {
        const { factory, membro, auth } = await montar();
        const terceiro = comPapel(new Usuario("Caio", "caio@konvex.com.br", true, "x", membro.senioridade, "usr-caio"), "membro");
        await factory.criarUsuarioRepository().criar(terceiro);
        const perfil = await new ObterPerfilPessoa(factory).execute(membro.codigo, auth(terceiro));
        // Atuais aparecem restritos; a saída de Ana do "Sigiloso antigo" não aparece.
        expect(perfil.projetosAtuais.map((p) => [p.codigo, p.restrito]).sort()).toEqual([
            ["p-normal", true],
            ["p-sig", true],
        ]);
        expect(perfil.projetosAnteriores).toEqual([]);
    });

    it("ocupação: sigiloso alheio vira linha do projeto, sem título da tarefa (sessão 27b)", async () => {
        const { factory, membro, outro, auth } = await montar();
        const hojeSp = hoje();
        const dia = 86_400_000;
        const oculto = new Projeto("Oculto", "d", dataInicio, dataFim, undefined, [outro], "p-oculto", {});
        await factory.criarProjetoRepository().criar(oculto);
        const tarefa = new Tarefa(
            oculto,
            "Secreta",
            new Date(hojeSp.getTime() - 7 * dia),
            new Date(hojeSp.getTime() + 7 * dia),
            StatusTarefa.PENDENTE,
            PrioridadeTarefa.P2,
            null,
            null,
            null,
            [outro],
            [],
            undefined,
            null,
            null,
            null,
            DificuldadeTarefa.DIFICIL,
        );
        await factory.criarTarefaRepository().criar(tarefa);
        const perfil = await new ObterPerfilPessoa(factory).execute(outro.codigo, auth(membro));
        expect(perfil.ocupacao.horas).toBeGreaterThan(0);
        expect(perfil.ocupacao.itens).toEqual([
            expect.objectContaining({ tipo: "projeto", projeto: { codigo: "p-oculto", nome: "Oculto" } }),
        ]);
        expect(JSON.stringify(perfil.ocupacao)).not.toContain("Secreta");
        // A própria pessoa (está no projeto) vê a linha da tarefa.
        const completo = await new ObterPerfilPessoa(factory).execute(outro.codigo, auth(outro));
        expect(completo.ocupacao.itens.map((i) => i.tipo)).toContain("tarefa");
        expect(completo.ocupacao.horas).toBe(perfil.ocupacao.horas);
        expect(completo.ocupacao.percentual).toBe(perfil.ocupacao.percentual);
    });
});
