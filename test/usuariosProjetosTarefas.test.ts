import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import Usuario from "../source/domain/Entity/Usuario";
import SenioridadeUsuario from "../source/domain/Entity/SenioridadeUsuario";
import PerfilUsuario from "../source/domain/Enum/PerfilUsuario";
import StatusTarefa from "../source/domain/Enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/Enum/PrioridadeTarefa";
import CriarProjeto from "../source/useCases/CriarProjeto/CriarProjeto";
import ListarProjetos from "../source/useCases/ListarProjetos/ListarProjetos";
import EditarProjeto from "../source/useCases/EditarProjeto/EditarProjeto";
import AlternarStatusProjeto from "../source/useCases/AlternarStatusProjeto/AlternarStatusProjeto";
import ExcluirProjeto from "../source/useCases/ExcluirProjeto/ExcluirProjeto";
import CriarTarefa from "../source/useCases/CriarTarefa/CriarTarefa";
import ListarTarefas from "../source/useCases/ListarTarefas/ListarTarefas";
import EditarTarefa from "../source/useCases/EditarTarefa/EditarTarefa";
import AlterarStatusTarefa from "../source/useCases/AlterarStatusTarefa/AlterarStatusTarefa";
import ExcluirTarefa from "../source/useCases/ExcluirTarefa/ExcluirTarefa";
import ListarUsuarios from "../source/useCases/ListarUsuarios/ListarUsuarios";
import EditarUsuario from "../source/useCases/EditarUsuario/EditarUsuario";
import InativarUsuario from "../source/useCases/InativarUsuario/InativarUsuario";

describe("Casos de uso de usuários, projetos e tarefas", () => {
  let factory: MemoryRepositoryFactory;
  let membro: Usuario;
  const inicio = new Date("2026-10-12T00:00:00.000Z");
  const fim = new Date("2026-10-30T00:00:00.000Z");
  beforeEach(async () => {
    factory = new MemoryRepositoryFactory();
    const senioridade = new SenioridadeUsuario("pleno", "Pleno", 75);
    membro = new Usuario("Ana", "ana@konvex.com.br", PerfilUsuario.MEMBRO, true, "hash", senioridade, "usr-ana");
    await factory.criarUsuarioRepository().criar(membro);
  });

  test("lista usuários", async () => {
    expect(await new ListarUsuarios(factory).execute()).toHaveLength(1);
  });

  test("edita usuário e normaliza o e-mail", async () => {
    const atualizado = await new EditarUsuario(factory).execute({ codigo: membro.codigo, nome: " Ana Silva ", email: " ANA@KONVEX.COM.BR ", perfil: PerfilUsuario.MEMBRO, senioridade: membro.senioridade });
    expect(atualizado.nome).toBe("Ana Silva");
    expect(atualizado.email).toBe("ana@konvex.com.br");
  });

  test("inativa usuário", async () => {
    await new InativarUsuario(factory).execute(membro.codigo);
    expect((await factory.criarUsuarioRepository().buscarPorCodigo(membro.codigo))?.ativo).toBe(false);
  });

  test("cria, lista, edita, conclui e reabre projeto", async () => {
    const criar = new CriarProjeto(factory);
    const projeto = await criar.execute({ nome: " Projeto A ", descricao: " Descrição ", dataInicio: inicio, dataFim: fim, codigosMembros: [membro.codigo] });
    expect(projeto.nome).toBe("Projeto A");
    expect(await new ListarProjetos(factory).execute(membro.codigo)).toHaveLength(1);
    const editado = await new EditarProjeto(factory).execute({ codigo: projeto.codigo, nome: "Projeto B", descricao: "Nova descrição", dataInicio: inicio, dataFim: fim, codigosMembros: [membro.codigo] });
    expect(editado.nome).toBe("Projeto B");
    const alternar = new AlternarStatusProjeto(factory);
    expect((await alternar.execute(projeto.codigo)).status).toBe("concluido");
    expect((await alternar.execute(projeto.codigo)).status).toBe("em_execucao");
  });

  test("cria, filtra, edita, conclui e exclui tarefa", async () => {
    const projeto = await new CriarProjeto(factory).execute({ nome: "Projeto", descricao: "Descrição", dataInicio: inicio, dataFim: fim, codigosMembros: [membro.codigo] });
    const tarefa = await new CriarTarefa(factory).execute({ codigoProjeto: projeto.codigo, titulo: " Tarefa A ", dataInicio: inicio, dataFim: fim, prioridade: PrioridadeTarefa.P2, codigosResponsaveis: [membro.codigo] });
    expect(tarefa.titulo).toBe("Tarefa A");
    expect(await new ListarTarefas(factory).execute({ codigoProjeto: projeto.codigo })).toHaveLength(1);
    expect(await new ListarTarefas(factory).execute({ codigoResponsavel: membro.codigo })).toHaveLength(1);
    const editada = await new EditarTarefa(factory).execute({ codigo: tarefa.codigo, titulo: "Tarefa B", dataInicio: inicio, dataFim: fim, status: StatusTarefa.PENDENTE, prioridade: PrioridadeTarefa.P1, codigosResponsaveis: [membro.codigo] });
    expect(editada.titulo).toBe("Tarefa B");
    const concluida = await new AlterarStatusTarefa(factory).execute(tarefa.codigo, StatusTarefa.CONCLUIDA, new Date("2026-10-20T00:00:00.000Z"));
    expect(concluida.status).toBe(StatusTarefa.CONCLUIDA);
    expect(concluida.dataConclusao).toBeInstanceOf(Date);
    await new ExcluirTarefa(factory).execute(tarefa.codigo);
    expect(await new ListarTarefas(factory).execute()).toHaveLength(0);
  });

  test("exclui projeto e suas tarefas", async () => {
    const projeto = await new CriarProjeto(factory).execute({ nome: "Projeto", descricao: "Descrição", dataInicio: inicio, dataFim: fim, codigosMembros: [membro.codigo] });
    await new CriarTarefa(factory).execute({ codigoProjeto: projeto.codigo, titulo: "Tarefa", dataInicio: inicio, dataFim: fim, codigosResponsaveis: [membro.codigo] });
    await new ExcluirProjeto(factory).execute(projeto.codigo);
    expect(await new ListarProjetos(factory).execute()).toHaveLength(0);
    expect(await new ListarTarefas(factory).execute()).toHaveLength(0);
  });
});
