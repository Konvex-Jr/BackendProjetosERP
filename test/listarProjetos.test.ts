import ListarProjetos from "../source/useCases/ListarProjetos/ListarProjetos";
import { criarContexto, criarProjeto } from "./fixtures";

test("lista projetos associados a um membro", async () => {
  const { factory, membro } = await criarContexto();
  await criarProjeto(factory, membro);

  const projetos = await new ListarProjetos(factory).execute(membro.codigo);

  expect(projetos).toHaveLength(1);
  expect(projetos[0].codigo).toBe("projeto-teste");
});
