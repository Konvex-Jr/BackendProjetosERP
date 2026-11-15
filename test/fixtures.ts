import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import Usuario from "../source/domain/entity/Usuario";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";
import Capacitacao from "../source/domain/entity/Capacitacao";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import TipoCapacitacao from "../source/domain/enum/TipoCapacitacao";
import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";

export const dataInicio = new Date("2026-10-12T00:00:00.000Z");
export const dataFim = new Date("2026-10-30T00:00:00.000Z");
export const semana = new Date("2026-10-12T00:00:00.000Z");

export async function criarContexto() {
    const factory = new MemoryRepositoryFactory();
    const senioridade = new SenioridadeUsuario("pleno", "Pleno", 75);
    const membro = new Usuario("Ana Silva", "ana@konvex.com.br", PerfilUsuario.MEMBRO, true, "senha-hash", senioridade, "usr-ana");
    const gerente = new Usuario("João Souza", "joao@konvex.com.br", PerfilUsuario.GERENTE, true, "senha-hash", senioridade, "usr-joao");

    await factory.criarUsuarioRepository().criar(membro);
    await factory.criarUsuarioRepository().criar(gerente);

    const capacitacao = new Capacitacao({
        titulo: "DDD e Clean Architecture",
        data: new Date("2026-11-20T00:00:00.000Z"),
        hora: "18:30",
        instrutor: { codigo: gerente.codigo, nome: gerente.nome },
        vagas: 5,
        tipo: TipoCapacitacao.COMPUTACAO,
        sala: "I-304",
        codigo: "cap-ddd",
    });
    await factory.criarCapacitacaoRepository().criar(capacitacao);

    return { factory, membro, gerente, senioridade, capacitacao };
}

export async function criarProjeto(factory: MemoryRepositoryFactory, membro: Usuario) {
    const projeto = new Projeto("Projeto de Teste", "Descrição do projeto", dataInicio, dataFim, undefined, [membro], "projeto-teste");
    return factory.criarProjetoRepository().criar(projeto);
}

export async function criarTarefa(factory: MemoryRepositoryFactory, membro: Usuario, projetoExistente?: Projeto, codigo = "tarefa-teste") {
    const projeto = projetoExistente ?? (await criarProjeto(factory, membro));
    const tarefa = new Tarefa(
        projeto,
        "Tarefa de Teste",
        dataInicio,
        dataFim,
        StatusTarefa.PENDENTE,
        PrioridadeTarefa.P2,
        "Descrição da tarefa",
        null,
        null,
        [membro],
        [],
        codigo,
    );
    return factory.criarTarefaRepository().criar(tarefa);
}
