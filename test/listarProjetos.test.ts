import ListarProjetos from "../source/useCases/projetos/ListarProjetos";
import Projeto from "../source/domain/entity/Projeto";
import { criarContexto, criarProjeto, dataFim, dataInicio } from "./fixtures";

test("lista projetos associados a um membro", async () => {
    const { factory, membro } = await criarContexto();
    await criarProjeto(factory, membro);

    const projetos = await new ListarProjetos(factory).execute(membro.codigo);

    expect(projetos).toHaveLength(1);
    expect(projetos[0].codigo).toBe("projeto-teste");
});

test("com codigoUsuario, une os projetos da equipe e os sigilosos com acesso, sem repetir", async () => {
    const { factory, membro } = await criarContexto();
    const repo = factory.criarProjetoRepository();
    await repo.criar(
        new Projeto("Meu", "d", dataInicio, dataFim, undefined, [membro], "p-meu", { sigiloso: true, acesso: [membro.codigo] }),
    );
    await repo.criar(
        new Projeto("Liberado", "d", dataInicio, dataFim, undefined, [], "p-lib", { sigiloso: true, acesso: [membro.codigo] }),
    );
    await repo.criar(new Projeto("Alheio", "d", dataInicio, dataFim, undefined, [], "p-alheio", { sigiloso: true }));

    const projetos = await new ListarProjetos(factory).execute(membro.codigo);

    expect(projetos.map((p) => p.codigo).sort()).toEqual(["p-lib", "p-meu"]);
});
