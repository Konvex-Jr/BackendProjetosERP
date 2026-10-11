import InscreverCapacitacao from "../source/useCases/InscreverCapacitacao/InscreverCapacitacao";
import { criarContexto } from "./fixtures";

test("inscreve um usuário em uma capacitação com vagas", async () => {
  const { factory, membro, capacitacao } = await criarContexto();

  const atualizada = await new InscreverCapacitacao(factory).execute(capacitacao.codigo, membro.codigo);

  expect(atualizada.estaInscrito(membro)).toBe(true);
});
