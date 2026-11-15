import ExcluirTarefa from "../source/useCases/tarefas/ExcluirTarefa";
import { DonoAnexo } from "../source/domain/enum/Anexo";
import GerirAnexos from "../source/useCases/anexos/GerirAnexos";
import { criarContexto, criarTarefa } from "./fixtures";

test("exclui uma tarefa existente", async () => {
    const { factory, membro } = await criarContexto();
    const tarefa = await criarTarefa(factory, membro);

    await new ExcluirTarefa(factory).execute(tarefa.codigo);

    expect(await factory.criarTarefaRepository().listar()).toHaveLength(0);
});

test("excluir a tarefa apaga os anexos e os arquivos", async () => {
    const { factory, membro } = await criarContexto();
    const tarefa = await criarTarefa(factory, membro);
    const gerir = new GerirAnexos(factory);
    const usuario = { codigo: membro.codigo, perfil: membro.perfil };
    const a1 = await gerir.enviar(usuario, DonoAnexo.TAREFA, tarefa.codigo, { nome: "a.pdf", conteudo: Buffer.from("%PDF-1.4 a") });
    const a2 = await gerir.enviar(usuario, DonoAnexo.TAREFA, tarefa.codigo, { nome: "b.pdf", conteudo: Buffer.from("%PDF-1.4 b") });
    const armazenamento = factory.criarArmazenamentoAnexos();
    expect(await armazenamento.ler(a1.arquivo)).not.toBeNull();

    await new ExcluirTarefa(factory).execute(tarefa.codigo);

    expect(await factory.criarAnexoRepository().listarPorDonos(DonoAnexo.TAREFA, [tarefa.codigo])).toHaveLength(0);
    expect(await armazenamento.ler(a1.arquivo)).toBeNull();
    expect(await armazenamento.ler(a2.arquivo)).toBeNull();
});
