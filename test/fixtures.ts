import Area from "../source/domain/entity/Area";
import CriarUsuario from "../source/useCases/pessoas/CriarUsuario";
import CriarUsuarioInput from "../source/useCases/pessoas/CriarUsuarioInput";
import GerirLinkSenha from "../source/useCases/auth/GerirLinkSenha";
import EnvioEmailMemoria from "../source/infra/email/EnvioEmailMemoria";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import Usuario from "../source/domain/entity/Usuario";
import SenioridadeUsuario from "../source/domain/entity/SenioridadeUsuario";
import Capacitacao from "../source/domain/entity/Capacitacao";
import TipoCapacitacao from "../source/domain/enum/TipoCapacitacao";
import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import PrioridadeTarefa from "../source/domain/enum/PrioridadeTarefa";
import { comPapel } from "./papel";

export const dataInicio = new Date("2026-10-12T00:00:00.000Z");
export const dataFim = new Date("2026-10-30T00:00:00.000Z");
export const semana = new Date("2026-10-12T00:00:00.000Z");

export async function criarContexto() {
    const factory = new MemoryRepositoryFactory();
    const senioridade = new SenioridadeUsuario("pleno", "Pleno", 75);
    const membro = comPapel(new Usuario("Ana Silva", "ana@konvex.com.br", true, "senha-hash", senioridade, "usr-ana"), "membro");
    const gerente = comPapel(new Usuario("João Souza", "joao@konvex.com.br", true, "senha-hash", senioridade, "usr-joao"), "gerente");

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

/** Cadastra a pessoa pelo convite e define a senha pelo link, como na vida real. */
export async function cadastrarComSenha(factory: MemoryRepositoryFactory, input: CriarUsuarioInput, senha: string) {
    const { usuario } = await new CriarUsuario(factory).execute(input);
    const token = (factory.criarEnvioEmail() as EnvioEmailMemoria).ultimoLink(usuario.email);
    if (!token) throw new Error("Convite não enviado.");
    await new GerirLinkSenha(factory).usar(token, senha, senha);
    return usuario;
}

/**
 * Sessão 31b: projeto novo exige classe e, se for de cliente, área. Cria a área "Clientes (teste)"
 * na primeira chamada e devolve os dois campos para espalhar no corpo do POST ou no input de CriarProjeto.
 */
export async function obrigatoriosDoProjeto(factory: {
    criarAreaRepository(): any;
}): Promise<{ codigoClasse: string; codigoArea: string }> {
    const codigoArea = "area-clientes-teste";
    const areas = factory.criarAreaRepository();
    if (!(await areas.buscarPorCodigo(codigoArea))) await areas.criar(new Area("Clientes (teste)", null, true, codigoArea));
    return { codigoClasse: "outro", codigoArea };
}
