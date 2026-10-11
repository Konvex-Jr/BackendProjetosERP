import CriarProjeto from "../source/useCases/CriarProjeto/CriarProjeto";
import { criarContexto, dataInicio, dataFim } from "./fixtures";

test("cria um projeto com membros válidos", async () => {
  const { factory, membro } = await criarContexto();

  const projeto = await new CriarProjeto(factory).execute({
    nome: " Projeto Novo ",
    descricao: " Descrição do projeto ",
    dataInicio,
    dataFim,
    codigosMembros: [membro.codigo],
  });

  expect(projeto.nome).toBe("Projeto Novo");
  expect(projeto.membros).toHaveLength(1);
});
