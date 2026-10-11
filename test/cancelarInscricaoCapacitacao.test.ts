import InscreverCapacitacao from "../source/useCases/InscreverCapacitacao/InscreverCapacitacao";
import CancelarInscricaoCapacitacao from "../source/useCases/CancelarInscricaoCapacitacao/CancelarInscricaoCapacitacao";
import { criarContexto } from "./fixtures";

test("cancela a inscrição de um usuário", async () => {
  const { factory, membro, capacitacao } = await criarContexto();
  await new InscreverCapacitacao(factory).execute(capacitacao.codigo, membro.codigo);

  const atualizada = await new CancelarInscricaoCapacitacao(factory).execute(capacitacao.codigo, membro.codigo);

  expect(atualizada.estaInscrito(membro)).toBe(false);
});
