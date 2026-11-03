import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import Usuario from "../source/domain/Entity/Usuario";
import SenioridadeUsuario from "../source/domain/Entity/SenioridadeUsuario";
import Capacitacao from "../source/domain/Entity/Capacitacao";
import PerfilUsuario from "../source/domain/Enum/PerfilUsuario";
import TipoCapacitacao from "../source/domain/Enum/TipoCapacitacao";
import InscreverCapacitacao from "../source/useCases/InscreverCapacitacao/InscreverCapacitacao";
import CancelarInscricaoCapacitacao from "../source/useCases/CancelarInscricaoCapacitacao/CancelarInscricaoCapacitacao";
import ListarCapacitacoes from "../source/useCases/ListarCapacitacoes/ListarCapacitacoes";
import EnviarFeedbackCapacitacao from "../source/useCases/EnviarFeedbackCapacitacao/EnviarFeedbackCapacitacao";
import ListarFeedbacks from "../source/useCases/ListarFeedbacks/ListarFeedbacks";

describe("Casos de uso de capacitações", () => {
  let factory: MemoryRepositoryFactory;
  let membro: Usuario;
  let instrutor: Usuario;
  let capacitacao: Capacitacao;
  beforeEach(async () => {
    factory = new MemoryRepositoryFactory();
    const senioridade = new SenioridadeUsuario("pleno", "Pleno", 75);
    membro = new Usuario("Ana", "ana@konvex.com.br", PerfilUsuario.MEMBRO, true, "hash", senioridade, "usr-ana");
    instrutor = new Usuario("João", "joao@konvex.com.br", PerfilUsuario.GERENTE, true, "hash", senioridade, "usr-joao");
    await factory.criarUsuarioRepository().criar(membro);
    await factory.criarUsuarioRepository().criar(instrutor);
    capacitacao = new Capacitacao("DDD", new Date("2026-11-20T00:00:00.000Z"), "18:30", instrutor, 5, TipoCapacitacao.COMPUTACAO, "I-304", [], "cap-ddd");
    await factory.criarCapacitacaoRepository().criar(capacitacao);
  });

  test("lista capacitações e inscreve/cancela participante", async () => {
    expect(await new ListarCapacitacoes(factory).execute()).toHaveLength(1);
    const inscrita = await new InscreverCapacitacao(factory).execute(capacitacao.codigo, membro.codigo);
    expect(inscrita.estaInscrito(membro)).toBe(true);
    const cancelada = await new CancelarInscricaoCapacitacao(factory).execute(capacitacao.codigo, membro.codigo);
    expect(cancelada.estaInscrito(membro)).toBe(false);
  });

  test("envia e atualiza feedback de capacitação realizada", async () => {
    const realizada = new Capacitacao("DDD", new Date("2026-09-01T00:00:00.000Z"), "18:30", instrutor, 5, TipoCapacitacao.COMPUTACAO, "I-304", [membro], "cap-realizada");
    await factory.criarCapacitacaoRepository().criar(realizada);
    const enviar = new EnviarFeedbackCapacitacao(factory);
    const primeiro = await enviar.execute({ codigoCapacitacao: realizada.codigo, codigoUsuario: membro.codigo, nota: 4, data: new Date("2026-09-02T00:00:00.000Z"), bom: "Conteúdo claro" });
    expect(primeiro.nota).toBe(4);
    const atualizado = await enviar.execute({ codigoCapacitacao: realizada.codigo, codigoUsuario: membro.codigo, nota: 5, data: new Date("2026-09-03T00:00:00.000Z") });
    expect(atualizado.codigo).toBe(primeiro.codigo);
    expect(await new ListarFeedbacks(factory).execute(membro.codigo)).toHaveLength(1);
  });

});
