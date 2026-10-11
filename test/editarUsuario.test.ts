import EditarUsuario from "../source/useCases/EditarUsuario/EditarUsuario";
import PerfilUsuario from "../source/domain/Enum/PerfilUsuario";
import { criarContexto } from "./fixtures";

test("edita os dados e normaliza o e-mail do usuário", async () => {
  const { factory, membro, senioridade } = await criarContexto();
  const usuario = await new EditarUsuario(factory).execute({
    codigo: membro.codigo,
    nome: " Ana Silva Atualizada ",
    email: " ANA.SILVA@KONVEX.COM.BR ",
    perfil: PerfilUsuario.MEMBRO,
    senioridade,
  });

  expect(usuario.nome).toBe("Ana Silva Atualizada");
  expect(usuario.email).toBe("ana.silva@konvex.com.br");
});
