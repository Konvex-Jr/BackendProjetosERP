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

test("com codigoUsuario, só os projetos da equipe (quem só criou o sigiloso não o recebe)", async () => {
    const { factory, membro } = await criarContexto();
    const repo = factory.criarProjetoRepository();
    await repo.criar(new Projeto("Meu", "d", dataInicio, dataFim, undefined, [membro], "p-meu", {}));
    await repo.criar(new Projeto("Criado por ele", "d", dataInicio, dataFim, undefined, [], "p-criado", { criadoPor: membro.codigo }));
    await repo.criar(new Projeto("Alheio", "d", dataInicio, dataFim, undefined, [], "p-alheio", {}));

    const projetos = await new ListarProjetos(factory).execute(membro.codigo);

    expect(projetos.map((p) => p.codigo)).toEqual(["p-meu"]);
});
