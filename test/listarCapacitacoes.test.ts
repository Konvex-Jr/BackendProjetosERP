import ListarCapacitacoes from "../source/useCases/ListarCapacitacoes/ListarCapacitacoes";
import { criarContexto } from "./fixtures";

test("lista as capacitações cadastradas", async () => {
  const { factory, capacitacao } = await criarContexto();

  const capacitacoes = await new ListarCapacitacoes(factory).execute();

  expect(capacitacoes).toHaveLength(1);
  expect(capacitacoes[0].codigo).toBe(capacitacao.codigo);
});
