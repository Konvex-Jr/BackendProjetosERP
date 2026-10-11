import RegistrarCheckin from "../source/useCases/RegistrarCheckin/RegistrarCheckin";
import { criarContexto, semana } from "./fixtures";

test("registra um check-in semanal", async () => {
  const { factory, membro } = await criarContexto();

  const checkin = await new RegistrarCheckin(factory).execute({
    codigoUsuario: membro.codigo,
    semana,
    resumo: "Concluí as tarefas",
    aprendizados: "Aprendi DDD",
    humor: 4,
  });

  expect(checkin.usuario.codigo).toBe(membro.codigo);
  expect(checkin.humor).toBe(4);
});
