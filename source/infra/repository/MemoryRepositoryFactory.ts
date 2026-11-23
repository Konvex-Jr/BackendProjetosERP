import AvisoRepositoryMemory from "./memory/AvisoRepositoryMemory";
import ReuniaoRepositoryMemory from "./memory/ReuniaoRepositoryMemory";
import EnvioEmailMemoria from "../email/EnvioEmailMemoria";
import HorasDificuldadeRepositoryMemory from "./memory/HorasDificuldadeRepositoryMemory";
import RegrasPrecificacaoRepositoryMemory from "./memory/RegrasPrecificacaoRepositoryMemory";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/interfaces/UsuarioRepositoryInterface";
import SenioridadeRepositoryInterface from "../../domain/interfaces/SenioridadeRepositoryInterface";
import ProjetoRepositoryInterface from "../../domain/interfaces/ProjetoRepositoryInterface";
import TarefaRepositoryInterface from "../../domain/interfaces/TarefaRepositoryInterface";
import CapacitacaoRepositoryInterface from "../../domain/interfaces/CapacitacaoRepositoryInterface";
import CapacitacaoFeedbackRepositoryInterface from "../../domain/interfaces/CapacitacaoFeedbackRepositoryInterface";
import ColunaProjetoRepositoryInterface from "../../domain/interfaces/ColunaProjetoRepositoryInterface";
import ColunaProjetoRepositoryMemory from "./memory/ColunaProjetoRepositoryMemory";
import UsuarioRepositoryMemory from "./memory/UsuarioRepositoryMemory";
import SenioridadeRepositoryMemory from "./memory/SenioridadeRepositoryMemory";
import ProjetoRepositoryMemory from "./memory/ProjetoRepositoryMemory";
import TarefaRepositoryMemory from "./memory/TarefaRepositoryMemory";
import CapacitacaoRepositoryMemory from "./memory/CapacitacaoRepositoryMemory";
import CapacitacaoFeedbackRepositoryMemory from "./memory/CapacitacaoFeedbackRepositoryMemory";
import BibliotecaRepositoryMemory from "./memory/BibliotecaRepositoryMemory";
import AnexoRepositoryMemory from "./memory/AnexoRepositoryMemory";
import ArmazenamentoAnexosMemoria from "../arquivos/ArmazenamentoAnexosMemoria";
import ArmazenamentoFotosMemoria from "../arquivos/ArmazenamentoFotosMemoria";
import AreaRepositoryMemory from "./memory/AreaRepositoryMemory";
import CargoRepositoryMemory from "./memory/CargoRepositoryMemory";
import PeriodoAreaRepositoryMemory from "./memory/PeriodoAreaRepositoryMemory";
import LinkSenhaRepositoryMemory from "./memory/LinkSenhaRepositoryMemory";
import RefreshTokenRepositoryMemory from "./memory/RefreshTokenRepositoryMemory";
import ComentarioTarefaRepositoryMemory from "./memory/ComentarioTarefaRepositoryMemory";

/**
 * Repositórios em memória, para os testes rodarem rápido e sem PostgreSQL. Ao contrário da
 * versão em banco, cada repositório é criado uma vez e devolvido sempre o mesmo: é a instância
 * que guarda os dados, então todos os casos de uso de um teste precisam enxergar a mesma.
 * Uma factory nova = banco vazio (cada teste cria a sua).
 */
export default class MemoryRepositoryFactory implements RepositoryFactoryInterface {
    private readonly usuarioRepository: UsuarioRepositoryInterface;
    private readonly senioridadeRepository: SenioridadeRepositoryInterface;
    private readonly projetoRepository: ProjetoRepositoryInterface;
    private readonly tarefaRepository: TarefaRepositoryInterface;
    private readonly colunaProjetoRepository: ColunaProjetoRepositoryInterface;
    private readonly capacitacaoRepository: CapacitacaoRepositoryInterface;
    private readonly capacitacaoFeedbackRepository: CapacitacaoFeedbackRepositoryInterface;

    constructor() {
        this.usuarioRepository = new UsuarioRepositoryMemory();
        this.senioridadeRepository = new SenioridadeRepositoryMemory();
        this.projetoRepository = new ProjetoRepositoryMemory(this.periodoAreaRepository, this.areaRepository, this.usuarioRepository);
        this.tarefaRepository = new TarefaRepositoryMemory();
        this.colunaProjetoRepository = new ColunaProjetoRepositoryMemory(this.projetoRepository, this.tarefaRepository);
        this.capacitacaoRepository = new CapacitacaoRepositoryMemory();
        this.capacitacaoFeedbackRepository = new CapacitacaoFeedbackRepositoryMemory();
    }

    criarUsuarioRepository(): UsuarioRepositoryInterface {
        return this.usuarioRepository;
    }

    criarSenioridadeRepository(): SenioridadeRepositoryInterface {
        return this.senioridadeRepository;
    }

    criarProjetoRepository(): ProjetoRepositoryInterface {
        return this.projetoRepository;
    }

    criarTarefaRepository(): TarefaRepositoryInterface {
        return this.tarefaRepository;
    }

    criarColunaProjetoRepository(): ColunaProjetoRepositoryInterface {
        return this.colunaProjetoRepository;
    }

    criarCapacitacaoRepository(): CapacitacaoRepositoryInterface {
        return this.capacitacaoRepository;
    }

    criarCapacitacaoFeedbackRepository(): CapacitacaoFeedbackRepositoryInterface {
        return this.capacitacaoFeedbackRepository;
    }

    private readonly areaRepository = new AreaRepositoryMemory();
    private readonly cargoRepository = new CargoRepositoryMemory();
    private readonly horasDificuldadeRepository = new HorasDificuldadeRepositoryMemory();
    private readonly regrasPrecificacaoRepository = new RegrasPrecificacaoRepositoryMemory();
    private readonly periodoAreaRepository = new PeriodoAreaRepositoryMemory();
    private readonly refreshTokenRepository = new RefreshTokenRepositoryMemory();
    private readonly linkSenhaRepository = new LinkSenhaRepositoryMemory();
    private readonly avisoRepository = new AvisoRepositoryMemory();
    private readonly reuniaoRepository = new ReuniaoRepositoryMemory();
    private readonly comentarioTarefaRepository = new ComentarioTarefaRepositoryMemory();
    private readonly bibliotecaRepository = new BibliotecaRepositoryMemory();
    private readonly anexoRepository = new AnexoRepositoryMemory();
    /** Público para os testes conferirem quais arquivos foram gravados ou apagados. */
    readonly armazenamentoAnexos = new ArmazenamentoAnexosMemoria();

    criarAnexoRepository() {
        return this.anexoRepository;
    }

    criarArmazenamentoAnexos() {
        return this.armazenamentoAnexos;
    }

    /** Público para os testes conferirem quais fotos foram gravadas ou apagadas. */
    readonly armazenamentoFotos = new ArmazenamentoFotosMemoria();

    criarArmazenamentoFotos() {
        return this.armazenamentoFotos;
    }

    /** Público para os testes conferirem os e-mails enviados. */
    readonly envioEmail = new EnvioEmailMemoria();

    criarEnvioEmail() {
        return this.envioEmail;
    }

    /** Na memória não há transação: roda direto. Quem usa confere tudo o que pode falhar antes de gravar. */
    async emTransacao<T>(operacao: (factory: RepositoryFactoryInterface) => Promise<T>): Promise<T> {
        return operacao(this);
    }

    criarBibliotecaRepository() {
        return this.bibliotecaRepository;
    }

    criarAreaRepository() {
        return this.areaRepository;
    }

    criarCargoRepository() {
        return this.cargoRepository;
    }

    criarHorasDificuldadeRepository() {
        return this.horasDificuldadeRepository;
    }

    criarRegrasPrecificacaoRepository() {
        return this.regrasPrecificacaoRepository;
    }

    criarPeriodoAreaRepository() {
        return this.periodoAreaRepository;
    }

    criarComentarioTarefaRepository() {
        return this.comentarioTarefaRepository;
    }

    criarRefreshTokenRepository() {
        return this.refreshTokenRepository;
    }

    criarLinkSenhaRepository() {
        return this.linkSenhaRepository;
    }

    criarAvisoRepository() {
        return this.avisoRepository;
    }

    criarReuniaoRepository() {
        return this.reuniaoRepository;
    }
}
