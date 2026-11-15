import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/interfaces/UsuarioRepositoryInterface";
import SenioridadeRepositoryInterface from "../../domain/interfaces/SenioridadeRepositoryInterface";
import ProjetoRepositoryInterface from "../../domain/interfaces/ProjetoRepositoryInterface";
import TarefaRepositoryInterface from "../../domain/interfaces/TarefaRepositoryInterface";
import CapacitacaoRepositoryInterface from "../../domain/interfaces/CapacitacaoRepositoryInterface";
import CapacitacaoFeedbackRepositoryInterface from "../../domain/interfaces/CapacitacaoFeedbackRepositoryInterface";
import UsuarioRepositoryMemory from "./memory/UsuarioRepositoryMemory";
import SenioridadeRepositoryMemory from "./memory/SenioridadeRepositoryMemory";
import ProjetoRepositoryMemory from "./memory/ProjetoRepositoryMemory";
import TarefaRepositoryMemory from "./memory/TarefaRepositoryMemory";
import CapacitacaoRepositoryMemory from "./memory/CapacitacaoRepositoryMemory";
import CapacitacaoFeedbackRepositoryMemory from "./memory/CapacitacaoFeedbackRepositoryMemory";
import BibliotecaRepositoryMemory from "./memory/BibliotecaRepositoryMemory";
import AnexoRepositoryMemory from "./memory/AnexoRepositoryMemory";
import ArmazenamentoAnexosMemoria from "../arquivos/ArmazenamentoAnexosMemoria";
import AreaRepositoryMemory from "./memory/AreaRepositoryMemory";
import CargoRepositoryMemory from "./memory/CargoRepositoryMemory";
import HabilidadeRepositoryMemory from "./memory/HabilidadeRepositoryMemory";
import HistoricoPessoaRepositoryMemory from "./memory/HistoricoPessoaRepositoryMemory";
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
    private readonly capacitacaoRepository: CapacitacaoRepositoryInterface;
    private readonly capacitacaoFeedbackRepository: CapacitacaoFeedbackRepositoryInterface;

    constructor() {
        this.usuarioRepository = new UsuarioRepositoryMemory();
        this.senioridadeRepository = new SenioridadeRepositoryMemory();
        this.projetoRepository = new ProjetoRepositoryMemory();
        this.tarefaRepository = new TarefaRepositoryMemory();
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

    criarCapacitacaoRepository(): CapacitacaoRepositoryInterface {
        return this.capacitacaoRepository;
    }

    criarCapacitacaoFeedbackRepository(): CapacitacaoFeedbackRepositoryInterface {
        return this.capacitacaoFeedbackRepository;
    }

    private readonly areaRepository = new AreaRepositoryMemory();
    private readonly cargoRepository = new CargoRepositoryMemory();
    private readonly habilidadeRepository = new HabilidadeRepositoryMemory();
    private readonly historicoPessoaRepository = new HistoricoPessoaRepositoryMemory();
    private readonly refreshTokenRepository = new RefreshTokenRepositoryMemory();
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

    criarBibliotecaRepository() {
        return this.bibliotecaRepository;
    }

    criarAreaRepository() {
        return this.areaRepository;
    }

    criarCargoRepository() {
        return this.cargoRepository;
    }

    criarHabilidadeRepository() {
        return this.habilidadeRepository;
    }

    criarHistoricoPessoaRepository() {
        return this.historicoPessoaRepository;
    }

    criarComentarioTarefaRepository() {
        return this.comentarioTarefaRepository;
    }

    criarRefreshTokenRepository() {
        return this.refreshTokenRepository;
    }
}
