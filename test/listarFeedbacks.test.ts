import Capacitacao from "../source/domain/Entity/Capacitacao";
import TipoCapacitacao from "../source/domain/Enum/TipoCapacitacao";
import EnviarFeedbackCapacitacao from "../source/useCases/EnviarFeedbackCapacitacao/EnviarFeedbackCapacitacao";
import ListarFeedbacks from "../source/useCases/ListarFeedbacks/ListarFeedbacks";
import { criarContexto } from "./fixtures";

test("lista os feedbacks de um usuário", async () => {
  const { factory, membro, gerente } = await criarContexto();
  const realizada = new Capacitacao(
    "Capacitação realizada",
    new Date("2026-09-01T00:00:00.000Z"),
    "18:30",
    gerente,
    5,
    TipoCapacitacao.COMPUTACAO,
    "I-304",
    [membro],
    "cap-realizada",
  );
  await factory.criarCapacitacaoRepository().criar(realizada);
  await new EnviarFeedbackCapacitacao(factory).execute({
    codigoCapacitacao: realizada.codigo,
    codigoUsuario: membro.codigo,
    nota: 4,
  });

  const feedbacks = await new ListarFeedbacks(factory).execute(membro.codigo);

  expect(feedbacks).toHaveLength(1);
  expect(feedbacks[0].nota).toBe(4);
});
