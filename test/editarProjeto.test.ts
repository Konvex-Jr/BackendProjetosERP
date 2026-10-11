import EditarProjeto from "../source/useCases/EditarProjeto/EditarProjeto";
import { criarContexto, criarProjeto, dataInicio, dataFim } from "./fixtures";

test("edita os dados de um projeto existente", async () => {
  const { factory, membro } = await criarContexto();
  const projeto = await criarProjeto(factory, membro);

  const atualizado = await new EditarProjeto(factory).execute({
    codigo: projeto.codigo,
    nome: "Projeto Atualizado",
    descricao: "Nova descrição",
    dataInicio,
    dataFim,
    codigosMembros: [membro.codigo],
  });

  expect(atualizado.nome).toBe("Projeto Atualizado");
  expect(atualizado.descricao).toBe("Nova descrição");
});
