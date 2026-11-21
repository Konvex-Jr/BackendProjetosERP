import AvisoRepositoryDatabase from "./database/AvisoRepositoryDatabase";
import EnvioEmailInterface from "../../domain/interfaces/EnvioEmailInterface";
import criarEnvioEmail from "../email/criarEnvioEmail";
import HorasDificuldadeRepositoryDatabase from "./database/HorasDificuldadeRepositoryDatabase";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/interfaces/UsuarioRepositoryInterface";
import SenioridadeRepositoryInterface from "../../domain/interfaces/SenioridadeRepositoryInterface";
import ProjetoRepositoryInterface from "../../domain/interfaces/ProjetoRepositoryInterface";
import TarefaRepositoryInterface from "../../domain/interfaces/TarefaRepositoryInterface";
import CapacitacaoRepositoryInterface from "../../domain/interfaces/CapacitacaoRepositoryInterface";
import CapacitacaoFeedbackRepositoryInterface from "../../domain/interfaces/CapacitacaoFeedbackRepositoryInterface";
import ColunaProjetoRepositoryInterface from "../../domain/interfaces/ColunaProjetoRepositoryInterface";
import ConexaoBanco from "../database/ConexaoBanco";
import UsuarioRepositoryDatabase from "./database/UsuarioRepositoryDatabase";
import SenioridadeRepositoryDatabase from "./database/SenioridadeRepositoryDatabase";
import ProjetoRepositoryDatabase from "./database/ProjetoRepositoryDatabase";
import TarefaRepositoryDatabase from "./database/TarefaRepositoryDatabase";
import CapacitacaoRepositoryDatabase from "./database/CapacitacaoRepositoryDatabase";
import CapacitacaoFeedbackRepositoryDatabase from "./database/CapacitacaoFeedbackRepositoryDatabase";
import ColunaProjetoRepositoryDatabase from "./database/ColunaProjetoRepositoryDatabase";
import AreaRepositoryDatabase from "./database/AreaRepositoryDatabase";
import CargoRepositoryDatabase from "./database/CargoRepositoryDatabase";
import PeriodoAreaRepositoryDatabase from "./database/PeriodoAreaRepositoryDatabase";
import LinkSenhaRepositoryDatabase from "./database/LinkSenhaRepositoryDatabase";
import RefreshTokenRepositoryDatabase from "./database/RefreshTokenRepositoryDatabase";
import ComentarioTarefaRepositoryDatabase from "./database/ComentarioTarefaRepositoryDatabase";
import BibliotecaRepositoryDatabase from "./database/BibliotecaRepositoryDatabase";
import AnexoRepositoryDatabase from "./database/AnexoRepositoryDatabase";
import ArmazenamentoAnexosDisco from "../arquivos/ArmazenamentoAnexosDisco";
import ArmazenamentoFotosDisco from "../arquivos/ArmazenamentoFotosDisco";
import ArmazenamentoComExclusaoAdiada from "../arquivos/ArmazenamentoComExclusaoAdiada";

/**
 * Repositórios em PostgreSQL (produção e testes de integração). Cada chamada cria um repositório
 * novo: eles não guardam estado, todos usam a mesma conexão (pool) e os dados ficam no banco.
 * Repositório novo também precisa de um método em MemoryRepositoryFactory.
 */
export default class DatabaseRepositoryFactory implements RepositoryFactoryInterface {
    private readonly conexao: ConexaoBanco;
    /** Só dentro de `emTransacao`: arquivos de anexo a apagar do disco depois do COMMIT. */
    private readonly arquivosAExcluir?: string[];

    constructor(conexao: ConexaoBanco, arquivosAExcluir?: string[]) {
        this.conexao = conexao;
        this.arquivosAExcluir = arquivosAExcluir;
    }

    async emTransacao<T>(operacao: (factory: RepositoryFactoryInterface) => Promise<T>): Promise<T> {
        // Já numa transação: reaproveita (quem abriu a de fora apaga os arquivos depois do COMMIT dela).
        if (this.arquivosAExcluir) return operacao(this);
        const arquivos: string[] = [];
        const resultado = await this.conexao.transacao((conexao) => operacao(new DatabaseRepositoryFactory(conexao, arquivos)));
        const disco = new ArmazenamentoAnexosDisco();
        for (const arquivo of arquivos) {
            // Os registros já saíram do banco: um arquivo que falhe aqui só sobra no disco (o conferirAnexos acha).
            await disco.excluir(arquivo).catch((erro) => console.error(erro));
        }
        return resultado;
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

    criarColunaProjetoRepository(): ColunaProjetoRepositoryInterface {
        return new ColunaProjetoRepositoryDatabase(this.conexao);
    }

    criarCapacitacaoRepository(): CapacitacaoRepositoryInterface {
        return new CapacitacaoRepositoryDatabase(this.conexao);
    }

    criarCapacitacaoFeedbackRepository(): CapacitacaoFeedbackRepositoryInterface {
        return new CapacitacaoFeedbackRepositoryDatabase(this.conexao);
    }

    criarAreaRepository() {
        return new AreaRepositoryDatabase(this.conexao);
    }

    criarCargoRepository() {
        return new CargoRepositoryDatabase(this.conexao);
    }

    criarHorasDificuldadeRepository() {
        return new HorasDificuldadeRepositoryDatabase(this.conexao);
    }

    criarPeriodoAreaRepository() {
        return new PeriodoAreaRepositoryDatabase(this.conexao);
    }

    criarComentarioTarefaRepository() {
        return new ComentarioTarefaRepositoryDatabase(this.conexao);
    }

    criarBibliotecaRepository() {
        return new BibliotecaRepositoryDatabase(this.conexao);
    }

    criarAnexoRepository() {
        return new AnexoRepositoryDatabase(this.conexao);
    }

    criarArmazenamentoAnexos() {
        // Os bytes ficam no disco (ANEXOS_DIR), não no banco; o banco guarda só o registro do anexo.
        const disco = new ArmazenamentoAnexosDisco();
        return this.arquivosAExcluir ? new ArmazenamentoComExclusaoAdiada(disco, this.arquivosAExcluir) : disco;
    }

    criarArmazenamentoFotos() {
        return new ArmazenamentoFotosDisco();
    }

    /** Um só para o processo todo (a factory é recriada a cada transação). */
    private static envioEmail?: EnvioEmailInterface;

    criarEnvioEmail() {
        return (DatabaseRepositoryFactory.envioEmail ??= criarEnvioEmail());
    }

    criarRefreshTokenRepository() {
        return new RefreshTokenRepositoryDatabase(this.conexao);
    }

    criarLinkSenhaRepository() {
        return new LinkSenhaRepositoryDatabase(this.conexao);
    }

    criarAvisoRepository() {
        return new AvisoRepositoryDatabase(this.conexao);
    }
}
