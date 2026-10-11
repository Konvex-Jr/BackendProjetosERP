import ListarCheckins from "../source/useCases/ListarCheckins/ListarCheckins";
import { criarContexto, criarCheckin } from "./fixtures";

test("lista check-ins e permite filtrar por usuário", async () => {
  const { factory, membro } = await criarContexto();
  await criarCheckin(factory, membro);

  expect(await new ListarCheckins(factory).execute()).toHaveLength(1);
  expect(await new ListarCheckins(factory).execute(membro.codigo)).toHaveLength(1);
});
