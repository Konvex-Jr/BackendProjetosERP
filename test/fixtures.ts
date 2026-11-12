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
import Pasta from "../source/domain/entity/Pasta";
import Documento from "../source/domain/entity/Documento";

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

export async function criarTarefa(factory: MemoryRepositoryFactory, membro: Usuario, projetoExistente?: Projeto) {
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
        "tarefa-teste",
    );
    return factory.criarTarefaRepository().criar(tarefa);
}

export async function criarPasta(factory: MemoryRepositoryFactory) {
    return factory.criarPastaRepository().criar(new Pasta("Documentos", "pasta-teste"));
}

export async function criarDocumento(factory: MemoryRepositoryFactory, membro: Usuario) {
    const pasta = await criarPasta(factory);
    const documento = new Documento(
        pasta,
        "ata-reuniao",
        120,
        new Date("2026-10-10T00:00:00.000Z"),
        membro,
        "https://storage.test/ata.pdf",
        "pdf",
        "documento-teste",
    );
    return factory.criarDocumentoRepository().criar(documento);
}
