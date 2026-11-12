import ListarUsuarios from "../source/useCases/pessoas/ListarUsuarios";
import { criarContexto } from "./fixtures";

test("lista os usuários cadastrados", async () => {
    const { factory } = await criarContexto();
    const usuarios = await new ListarUsuarios(factory).execute();

    expect(usuarios).toHaveLength(2);
});
