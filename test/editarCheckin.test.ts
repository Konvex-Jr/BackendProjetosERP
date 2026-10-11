import EditarCheckin from "../source/useCases/EditarCheckin/EditarCheckin";
import { criarContexto, criarCheckin, semana } from "./fixtures";

test("edita um check-in existente", async () => {
  const { factory, membro } = await criarContexto();
  const original = await criarCheckin(factory, membro);

  const atualizado = await new EditarCheckin(factory).execute({
    codigoUsuario: membro.codigo,
    semana,
    resumo: "Resumo atualizado",
    aprendizados: "Aprendi TDD",
    humor: 5,
  });

  expect(atualizado.codigo).toBe(original.codigo);
  expect(atualizado.resumo).toBe("Resumo atualizado");
});
