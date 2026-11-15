import ItemBiblioteca from "../source/domain/entity/ItemBiblioteca";
import { DonoAnexo } from "../source/domain/enum/Anexo";
import GerirAnexos from "../source/useCases/anexos/GerirAnexos";
import ExcluirProjeto from "../source/useCases/projetos/ExcluirProjeto";
import { criarContexto, criarProjeto, criarTarefa } from "./fixtures";

test("exclui o projeto e as tarefas associadas", async () => {
    const { factory, membro } = await criarContexto();
    const projeto = await criarProjeto(factory, membro);
    await criarTarefa(factory, membro, projeto);

    await new ExcluirProjeto(factory).execute(projeto.codigo);

    expect(await factory.criarProjetoRepository().listar()).toHaveLength(0);
    expect(await factory.criarTarefaRepository().listar()).toHaveLength(0);
});

test("excluir o projeto leva os itens da equipe (com anexos e arquivos) e solta os demais", async () => {
    const { factory, membro, gerente } = await criarContexto();
    const projeto = await criarProjeto(factory, membro);
    const ref = { codigo: projeto.codigo, nome: projeto.nome };
    const repo = factory.criarBibliotecaRepository();
    const equipe = await repo.criar(new ItemBiblioteca({ titulo: "Da equipe", sigilo: "projeto", projeto: ref, autor: { codigo: gerente.codigo, nome: gerente.nome } }));
    const aberto = await repo.criar(new ItemBiblioteca({ titulo: "Aberto", sigilo: "todos", projeto: ref, autor: { codigo: gerente.codigo, nome: gerente.nome } }));
    const anexo = await new GerirAnexos(factory).enviar({ codigo: gerente.codigo, perfil: gerente.perfil }, DonoAnexo.BIBLIOTECA, equipe.codigo, {
        nome: "ata.pdf",
        conteudo: Buffer.from("%PDF-1.4"),
    });
    const armazenamento = factory.criarArmazenamentoAnexos();
    expect(await armazenamento.ler(anexo.arquivo)).not.toBeNull();

    await new ExcluirProjeto(factory).execute(projeto.codigo);

    expect(await repo.buscarPorCodigo(equipe.codigo)).toBeNull();
    expect(await armazenamento.ler(anexo.arquivo)).toBeNull();
    expect(await factory.criarAnexoRepository().listarPorDonos(DonoAnexo.BIBLIOTECA, [equipe.codigo])).toHaveLength(0);
    expect((await repo.buscarPorCodigo(aberto.codigo))?.projeto).toBeNull();
});
