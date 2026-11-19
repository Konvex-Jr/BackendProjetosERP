import Participacao from "../source/domain/entity/Participacao";
import Projeto from "../source/domain/entity/Projeto";
import Usuario from "../source/domain/entity/Usuario";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
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
        expect(perfil.alocacao.projetos.map((p) => p.codigo).sort()).toEqual(["p-normal", "p-sig"]);
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

    it("membro olhando outro vê só normal em comum e sigiloso a que tem acesso completo", async () => {
        const { factory, membro, outro, auth } = await montar();
        const perfil = await new ObterPerfilPessoa(factory).execute(outro.codigo, auth(membro));
        const todos = [...perfil.projetosAtuais, ...perfil.projetosAnteriores];
        // Ana está na equipe atual de p-sig (completo); em p-sig-antigo saiu (nada): some.
        expect(todos.map((p) => p.codigo).sort()).toEqual(["p-normal", "p-sig"]);
        expect(todos.every((p) => !p.restrito)).toBe(true);
        expect(perfil.alocacao.projetos.map((p) => p.codigo).sort()).toEqual(["p-normal", "p-sig"]);
    });

    it("alocação total conta todos os projetos, e a lista só os visíveis", async () => {
        const { factory, membro, outro, auth } = await montar();
        const repo = factory.criarProjetoRepository();
        await repo.criar(new Projeto("Oculto", "d", dataInicio, dataFim, undefined, [outro], "p-oculto", { sigiloso: true }));
        const perfil = await new ObterPerfilPessoa(factory).execute(outro.codigo, auth(membro));
        expect(perfil.alocacao.projetos.map((p) => p.codigo)).not.toContain("p-oculto");
        const completo = await new ObterPerfilPessoa(factory).execute(outro.codigo);
        expect(completo.alocacao.projetos.map((p) => p.codigo)).toContain("p-oculto");
        expect(completo.alocacao.total).toBe(perfil.alocacao.total);
    });
});
