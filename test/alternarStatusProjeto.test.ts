import AlternarStatusProjeto from "../source/useCases/projetos/AlternarStatusProjeto";
import StatusProjeto from "../source/domain/enum/StatusProjeto";
import { criarContexto, criarProjeto } from "./fixtures";

test("alterna o status do projeto entre execução e conclusão", async () => {
    const { factory, membro } = await criarContexto();
    const projeto = await criarProjeto(factory, membro);
    const casoDeUso = new AlternarStatusProjeto(factory);

    expect((await casoDeUso.execute(projeto.codigo)).status).toBe(StatusProjeto.CONCLUIDO);
    expect((await casoDeUso.execute(projeto.codigo)).status).toBe(StatusProjeto.EM_EXECUCAO);
});
