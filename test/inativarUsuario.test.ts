import InativarUsuario from "../source/useCases/InativarUsuario/InativarUsuario";
import { criarContexto } from "./fixtures";

test("inativa um usuário cadastrado", async () => {
  const { factory, membro } = await criarContexto();

  await new InativarUsuario(factory).execute(membro.codigo);

  const usuario = await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo);
  expect(usuario?.ativo).toBe(false);
});
