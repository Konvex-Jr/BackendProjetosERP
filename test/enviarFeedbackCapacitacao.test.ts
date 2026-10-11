import Capacitacao from "../source/domain/Entity/Capacitacao";
import TipoCapacitacao from "../source/domain/Enum/TipoCapacitacao";
import EnviarFeedbackCapacitacao from "../source/useCases/EnviarFeedbackCapacitacao/EnviarFeedbackCapacitacao";
import { criarContexto } from "./fixtures";

test("registra feedback de uma capacitação realizada", async () => {
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

  const feedback = await new EnviarFeedbackCapacitacao(factory).execute({
    codigoCapacitacao: realizada.codigo,
    codigoUsuario: membro.codigo,
    nota: 5,
    bom: "Conteúdo claro",
  });

  expect(feedback.nota).toBe(5);
  expect(feedback.bom).toBe("Conteúdo claro");
});
