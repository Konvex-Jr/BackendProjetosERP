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
    const equipe = await repo.criar(
        new ItemBiblioteca({ titulo: "Da equipe", sigilo: "projeto", projeto: ref, autor: { codigo: gerente.codigo, nome: gerente.nome } }),
    );
    const aberto = await repo.criar(
        new ItemBiblioteca({ titulo: "Aberto", sigilo: "todos", projeto: ref, autor: { codigo: gerente.codigo, nome: gerente.nome } }),
    );
    const anexo = await new GerirAnexos(factory).enviar(
        { codigo: gerente.codigo, perfil: gerente.perfil },
        DonoAnexo.BIBLIOTECA,
        equipe.codigo,
        {
            nome: "ata.pdf",
            conteudo: Buffer.from("%PDF-1.4"),
        },
    );
    const armazenamento = factory.criarArmazenamentoAnexos();
    expect(await armazenamento.ler(anexo.arquivo)).not.toBeNull();

    await new ExcluirProjeto(factory).execute(projeto.codigo);

    expect(await repo.buscarPorCodigo(equipe.codigo)).toBeNull();
    expect(await armazenamento.ler(anexo.arquivo)).toBeNull();
    expect(await factory.criarAnexoRepository().listarPorDonos(DonoAnexo.BIBLIOTECA, [equipe.codigo])).toHaveLength(0);
    expect((await repo.buscarPorCodigo(aberto.codigo))?.projeto).toBeNull();
});

test("excluir o projeto apaga os anexos de todas as tarefas", async () => {
    const { factory, membro } = await criarContexto();
    const projeto = await criarProjeto(factory, membro);
    const t1 = await criarTarefa(factory, membro, projeto);
    const t2 = await criarTarefa(factory, membro, projeto, "tarefa-dois");
    const gerir = new GerirAnexos(factory);
    const usuario = { codigo: membro.codigo, perfil: membro.perfil };
    const anexos = [];
    for (const t of [t1, t2]) {
        for (const nome of ["a.pdf", "b.pdf"]) {
            anexos.push(await gerir.enviar(usuario, DonoAnexo.TAREFA, t.codigo, { nome, conteudo: Buffer.from("%PDF-1.4") }));
        }
    }
    const armazenamento = factory.criarArmazenamentoAnexos();
    expect(await armazenamento.ler(anexos[0].arquivo)).not.toBeNull();

    await new ExcluirProjeto(factory).execute(projeto.codigo);

    expect(await factory.criarAnexoRepository().listarPorDonos(DonoAnexo.TAREFA, [t1.codigo, t2.codigo])).toHaveLength(0);
    for (const a of anexos) expect(await armazenamento.ler(a.arquivo)).toBeNull();
});

test("excluir o projeto pega só os códigos das tarefas, sem montar as entidades", async () => {
    const { factory, membro } = await criarContexto();
    const projeto = await criarProjeto(factory, membro);
    const tarefa = await criarTarefa(factory, membro, projeto);
    const anexo = await new GerirAnexos(factory).enviar({ codigo: membro.codigo, perfil: membro.perfil }, DonoAnexo.TAREFA, tarefa.codigo, {
        nome: "a.pdf",
        conteudo: Buffer.from("%PDF-1.4"),
    });
    const tarefas = factory.criarTarefaRepository();
    // Excluir só precisa dos códigos das tarefas, sem montá-las como entidades.
    jest.spyOn(tarefas, "listarPorProjeto").mockRejectedValue(new Error("não deveria montar as tarefas"));
    const codigos = jest.spyOn(tarefas, "listarCodigosPorProjeto");

    await new ExcluirProjeto(factory).execute(projeto.codigo);

    expect(codigos).toHaveBeenCalledWith(projeto.codigo);
    expect(await factory.criarProjetoRepository().listar()).toHaveLength(0);
    expect(await factory.criarAnexoRepository().listarPorDonos(DonoAnexo.TAREFA, [tarefa.codigo])).toHaveLength(0);
    expect(await factory.criarArmazenamentoAnexos().ler(anexo.arquivo)).toBeNull();
});

test("se a limpeza dos anexos das tarefas falhar, a Biblioteca do projeto fica intacta", async () => {
    const { factory, membro, gerente } = await criarContexto();
    const projeto = await criarProjeto(factory, membro);
    const ref = { codigo: projeto.codigo, nome: projeto.nome };
    const repo = factory.criarBibliotecaRepository();
    const autor = { codigo: gerente.codigo, nome: gerente.nome };
    const equipe = await repo.criar(new ItemBiblioteca({ titulo: "Da equipe", sigilo: "projeto", projeto: ref, autor }));
    const aberto = await repo.criar(new ItemBiblioteca({ titulo: "Aberto", sigilo: "todos", projeto: ref, autor }));
    const original = GerirAnexos.prototype.excluirDosDonos;
    const falha = jest.spyOn(GerirAnexos.prototype, "excluirDosDonos").mockImplementation(async function (
        this: GerirAnexos,
        tipo,
        codigos,
    ) {
        if (tipo === DonoAnexo.TAREFA) throw new Error("falha no disco");
        return original.call(this, tipo, codigos);
    });

    try {
        await expect(new ExcluirProjeto(factory).execute(projeto.codigo)).rejects.toThrow("falha no disco");
    } finally {
        falha.mockRestore();
    }

    expect(await repo.buscarPorCodigo(equipe.codigo)).not.toBeNull();
    expect((await repo.buscarPorCodigo(aberto.codigo))?.projeto?.codigo).toBe(projeto.codigo);
});
