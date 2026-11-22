import Participacao from "../source/domain/entity/Participacao";
import Projeto from "../source/domain/entity/Projeto";
import Usuario from "../source/domain/entity/Usuario";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import Tarefa from "../source/domain/entity/Tarefa";
import DificuldadeTarefa from "../source/domain/enum/DificuldadeTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import { hoje } from "../source/shared/datas";
import ObterPerfilPessoa from "../source/useCases/pessoas/ObterPerfilPessoa";
import { criarContexto, dataFim, dataInicio } from "./fixtures";

const saida = new Date("2026-10-20T00:00:00.000Z");

async function montar() {
    const { factory, membro, gerente, senioridade } = await criarContexto();
    const outro = new Usuario("Beto Lima", "beto@konvex.com.br", PerfilUsuario.MEMBRO, true, "senha-hash", senioridade, "usr-beto");
    await factory.criarUsuarioRepository().criar(outro);
    const repo = factory.criarProjetoRepository();
    const detalhes = { referencia: "REF-SECRETA" };
    // Ana (membro) e Beto estão no normal e no sigiloso; Ana saiu do sigiloso "antigo".
    await repo.criar(new Projeto("Normal", "d", dataInicio, dataFim, undefined, [membro, outro], "p-normal", detalhes));
    await repo.criar(
        new Projeto("Sigiloso ativo", "d", dataInicio, dataFim, undefined, [membro, outro], "p-sig", { ...detalhes, sigiloso: true }),
    );
    await repo.criar(
        new Projeto(
            "Sigiloso antigo",
            "d",
            dataInicio,
            dataFim,
            undefined,
            [new Participacao(membro, { dataEntrada: dataInicio, dataSaida: saida }), outro],
            "p-sig-antigo",
            { ...detalhes, sigiloso: true },
        ),
    );
    const auth = (u: Usuario) => ({ codigo: u.codigo, perfil: u.perfil });
    return { factory, membro, gerente, outro, auth };
}

describe("Perfil da pessoa com projetos sigilosos", () => {
    it("gestão vê todos; sigiloso sem acesso vem restrito, sem referência nem função", async () => {
        const { factory, membro, gerente, auth } = await montar();
        const perfil = await new ObterPerfilPessoa(factory).execute(membro.codigo, auth(gerente));
        const todos = [...perfil.projetosAtuais, ...perfil.projetosAnteriores];
        expect(todos.map((p) => p.codigo).sort()).toEqual(["p-normal", "p-sig", "p-sig-antigo"]);
        const sig = todos.find((p) => p.codigo === "p-sig")!;
        expect(sig).toMatchObject({ nome: "Sigiloso ativo", sigiloso: true, restrito: true, referencia: null, funcao: null });
        expect(JSON.stringify(sig)).not.toContain("REF-SECRETA");
        const normal = todos.find((p) => p.codigo === "p-normal")!;
        expect(normal).toMatchObject({ sigiloso: false, restrito: false, referencia: "REF-SECRETA", tipo: "cliente", geralDaArea: false });
        expect(perfil.ocupacao.percentual).toBe(0);
    });

    it("a própria pessoa vê o que perdeu como restrito e o que ainda tem como completo", async () => {
        const { factory, membro, auth } = await montar();
        const perfil = await new ObterPerfilPessoa(factory).execute(membro.codigo, auth(membro));
        const todos = [...perfil.projetosAtuais, ...perfil.projetosAnteriores];
        expect(todos.map((p) => p.codigo).sort()).toEqual(["p-normal", "p-sig", "p-sig-antigo"]);
        expect(todos.find((p) => p.codigo === "p-sig")).toMatchObject({ sigiloso: true, restrito: false, referencia: "REF-SECRETA" });
        const antigo = todos.find((p) => p.codigo === "p-sig-antigo")!;
        expect(antigo).toMatchObject({ sigiloso: true, restrito: true, referencia: null, funcao: null });
        expect(JSON.stringify(antigo)).not.toContain("REF-SECRETA");
    });

    it("membro olhando outro vê todos os projetos dele; sem acesso completo = restrito (sessão 27b)", async () => {
        const { factory, membro, outro, auth } = await montar();
        const perfil = await new ObterPerfilPessoa(factory).execute(outro.codigo, auth(membro));
        const todos = [...perfil.projetosAtuais, ...perfil.projetosAnteriores];
        // Ana está na equipe atual de p-sig (completo); em p-sig-antigo Ana saiu e o outro segue: aparece restrito.
        expect(todos.map((p) => [p.codigo, p.restrito]).sort()).toEqual([
            ["p-normal", false],
            ["p-sig", false],
            ["p-sig-antigo", true],
        ]);
        expect(todos.find((p) => p.codigo === "p-sig-antigo")).toMatchObject({ referencia: null, funcao: null });
        expect(perfil.ocupacao).toMatchObject({ percentual: 0, horas: 0, itens: [] });
        expect("alocacao" in perfil).toBe(false);
    });

    it("membro não vê a passagem antiga de outra pessoa por projeto que não vê completo (como no cartão)", async () => {
        const { factory, membro, auth } = await montar();
        const terceiro = new Usuario("Caio", "caio@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", membro.senioridade, "usr-caio");
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
        const oculto = new Projeto("Oculto", "d", dataInicio, dataFim, undefined, [outro], "p-oculto", { sigiloso: true });
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
