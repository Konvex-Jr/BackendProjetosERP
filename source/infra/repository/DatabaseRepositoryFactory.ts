import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/interfaces/UsuarioRepositoryInterface";
import SenioridadeRepositoryInterface from "../../domain/interfaces/SenioridadeRepositoryInterface";
import ProjetoRepositoryInterface from "../../domain/interfaces/ProjetoRepositoryInterface";
import TarefaRepositoryInterface from "../../domain/interfaces/TarefaRepositoryInterface";
import CapacitacaoRepositoryInterface from "../../domain/interfaces/CapacitacaoRepositoryInterface";
import CapacitacaoFeedbackRepositoryInterface from "../../domain/interfaces/CapacitacaoFeedbackRepositoryInterface";
import PastaRepositoryInterface from "../../domain/interfaces/PastaRepositoryInterface";
import DocumentoRepositoryInterface from "../../domain/interfaces/DocumentoRepositoryInterface";
import ConexaoBanco from "../database/ConexaoBanco";
import UsuarioRepositoryDatabase from "./database/UsuarioRepositoryDatabase";
import SenioridadeRepositoryDatabase from "./database/SenioridadeRepositoryDatabase";
import ProjetoRepositoryDatabase from "./database/ProjetoRepositoryDatabase";
import TarefaRepositoryDatabase from "./database/TarefaRepositoryDatabase";
import CapacitacaoRepositoryDatabase from "./database/CapacitacaoRepositoryDatabase";
import CapacitacaoFeedbackRepositoryDatabase from "./database/CapacitacaoFeedbackRepositoryDatabase";
import PastaRepositoryDatabase from "./database/PastaRepositoryDatabase";
import DocumentoRepositoryDatabase from "./database/DocumentoRepositoryDatabase";
import AreaRepositoryDatabase from "./database/AreaRepositoryDatabase";
import CargoRepositoryDatabase from "./database/CargoRepositoryDatabase";
import HabilidadeRepositoryDatabase from "./database/HabilidadeRepositoryDatabase";
import HistoricoPessoaRepositoryDatabase from "./database/HistoricoPessoaRepositoryDatabase";
import RefreshTokenRepositoryDatabase from "./database/RefreshTokenRepositoryDatabase";
import ComentarioTarefaRepositoryDatabase from "./database/ComentarioTarefaRepositoryDatabase";
import ConhecimentoRepositoryDatabase from "./database/ConhecimentoRepositoryDatabase";
import IniciativaRepositoryDatabase from "./database/IniciativaRepositoryDatabase";
import AnexoRepositoryDatabase from "./database/AnexoRepositoryDatabase";
import ArmazenamentoAnexosDisco from "../arquivos/ArmazenamentoAnexosDisco";

/**
 * Repositórios em PostgreSQL (produção e testes de integração). Cada chamada cria um repositório
 * novo: eles não guardam estado, todos usam a mesma conexão (pool) e os dados ficam no banco.
 * Repositório novo também precisa de um método em MemoryRepositoryFactory.
 */
export default class DatabaseRepositoryFactory implements RepositoryFactoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    criarUsuarioRepository(): UsuarioRepositoryInterface {
        return new UsuarioRepositoryDatabase(this.conexao);
    }

    criarSenioridadeRepository(): SenioridadeRepositoryInterface {
        return new SenioridadeRepositoryDatabase(this.conexao);
    }

    criarProjetoRepository(): ProjetoRepositoryInterface {
        return new ProjetoRepositoryDatabase(this.conexao);
    }

    criarTarefaRepository(): TarefaRepositoryInterface {
        return new TarefaRepositoryDatabase(this.conexao);
    }

    criarCapacitacaoRepository(): CapacitacaoRepositoryInterface {
        return new CapacitacaoRepositoryDatabase(this.conexao);
    }

    criarCapacitacaoFeedbackRepository(): CapacitacaoFeedbackRepositoryInterface {
        return new CapacitacaoFeedbackRepositoryDatabase(this.conexao);
    }

    criarPastaRepository(): PastaRepositoryInterface {
        return new PastaRepositoryDatabase(this.conexao);
    }

    criarDocumentoRepository(): DocumentoRepositoryInterface {
        return new DocumentoRepositoryDatabase(this.conexao);
    }

    criarAreaRepository() {
        return new AreaRepositoryDatabase(this.conexao);
    }

    criarCargoRepository() {
        return new CargoRepositoryDatabase(this.conexao);
    }

    criarHabilidadeRepository() {
        return new HabilidadeRepositoryDatabase(this.conexao);
    }

    criarHistoricoPessoaRepository() {
        return new HistoricoPessoaRepositoryDatabase(this.conexao);
    }

    criarComentarioTarefaRepository() {
        return new ComentarioTarefaRepositoryDatabase(this.conexao);
    }

    criarConhecimentoRepository() {
        return new ConhecimentoRepositoryDatabase(this.conexao);
    }

    criarIniciativaRepository() {
        return new IniciativaRepositoryDatabase(this.conexao);
    }

    criarAnexoRepository() {
        return new AnexoRepositoryDatabase(this.conexao);
    }

    criarArmazenamentoAnexos() {
        // Os bytes ficam no disco (ANEXOS_DIR), não no banco; o banco guarda só o registro do anexo.
        return new ArmazenamentoAnexosDisco();
    }

    criarRefreshTokenRepository() {
        return new RefreshTokenRepositoryDatabase(this.conexao);
    }
}
