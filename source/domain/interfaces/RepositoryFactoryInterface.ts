import PermissoesRepositoryInterface from "./PermissoesRepositoryInterface";
import AvisoRepositoryInterface from "./AvisoRepositoryInterface";
import ReuniaoRepositoryInterface from "./ReuniaoRepositoryInterface";
import LinkSenhaRepositoryInterface from "./LinkSenhaRepositoryInterface";
import EnvioEmailInterface from "./EnvioEmailInterface";
import HorasDificuldadeRepositoryInterface from "./HorasDificuldadeRepositoryInterface";
import RegrasPrecificacaoRepositoryInterface from "./RegrasPrecificacaoRepositoryInterface";
import UsuarioRepositoryInterface from "./UsuarioRepositoryInterface";
import SenioridadeRepositoryInterface from "./SenioridadeRepositoryInterface";
import ClasseProjetoRepositoryInterface from "./ClasseProjetoRepositoryInterface";
import ProjetoRepositoryInterface from "./ProjetoRepositoryInterface";
import TarefaRepositoryInterface from "./TarefaRepositoryInterface";
import CapacitacaoRepositoryInterface from "./CapacitacaoRepositoryInterface";
import CapacitacaoFeedbackRepositoryInterface from "./CapacitacaoFeedbackRepositoryInterface";
import AreaRepositoryInterface from "./AreaRepositoryInterface";
import CargoRepositoryInterface from "./CargoRepositoryInterface";
import PeriodoAreaRepositoryInterface from "./PeriodoAreaRepositoryInterface";
import RefreshTokenRepositoryInterface from "./RefreshTokenRepositoryInterface";
import ComentarioTarefaRepositoryInterface from "./ComentarioTarefaRepositoryInterface";
import BibliotecaRepositoryInterface from "./BibliotecaRepositoryInterface";
import ColunaProjetoRepositoryInterface from "./ColunaProjetoRepositoryInterface";
import AnexoRepositoryInterface from "./AnexoRepositoryInterface";
import ArmazenamentoAnexosInterface from "./ArmazenamentoAnexosInterface";
import ArmazenamentoFotosInterface from "./ArmazenamentoFotosInterface";

/**
 * Ponto único de onde os casos de uso pegam os repositórios. Há duas implementações:
 * DatabaseRepositoryFactory (PostgreSQL, em produção e nos testes de integração) e
 * MemoryRepositoryFactory (listas em memória, nos testes rápidos, sem banco).
 * Os casos de uso só conhecem esta interface, então rodam igual nas duas.
 *
 * Repositório novo: interface em domain/interfaces, uma versão em memória, uma em banco
 * e um método `criar...` aqui e nas duas factories.
 */
export default interface RepositoryFactoryInterface {
    criarUsuarioRepository(): UsuarioRepositoryInterface;
    criarSenioridadeRepository(): SenioridadeRepositoryInterface;
    /** Classes de projeto (sessão 31b). */
    criarClasseProjetoRepository(): ClasseProjetoRepositoryInterface;
    criarProjetoRepository(): ProjetoRepositoryInterface;
    criarTarefaRepository(): TarefaRepositoryInterface;
    criarColunaProjetoRepository(): ColunaProjetoRepositoryInterface;
    criarCapacitacaoRepository(): CapacitacaoRepositoryInterface;
    criarCapacitacaoFeedbackRepository(): CapacitacaoFeedbackRepositoryInterface;
    criarAreaRepository(): AreaRepositoryInterface;
    criarCargoRepository(): CargoRepositoryInterface;
    criarPermissoesRepository(): PermissoesRepositoryInterface;
    criarPeriodoAreaRepository(): PeriodoAreaRepositoryInterface;
    criarHorasDificuldadeRepository(): HorasDificuldadeRepositoryInterface;
    criarRegrasPrecificacaoRepository(): RegrasPrecificacaoRepositoryInterface;
    criarRefreshTokenRepository(): RefreshTokenRepositoryInterface;
    criarLinkSenhaRepository(): LinkSenhaRepositoryInterface;
    criarAvisoRepository(): AvisoRepositoryInterface;
    criarReuniaoRepository(): ReuniaoRepositoryInterface;
    criarComentarioTarefaRepository(): ComentarioTarefaRepositoryInterface;
    criarBibliotecaRepository(): BibliotecaRepositoryInterface;
    criarAnexoRepository(): AnexoRepositoryInterface;
    /** Bytes dos anexos (disco em produção, memória nos testes). */
    criarArmazenamentoAnexos(): ArmazenamentoAnexosInterface;
    criarArmazenamentoFotos(): ArmazenamentoFotosInterface;
    /** Envio de e-mail (SMTP, log em dev; memória nos testes). */
    criarEnvioEmail(): EnvioEmailInterface;
    /**
     * Roda a operação numa ação só, com os repositórios da factory que ela recebe. No banco: uma
     * transação (erro = ROLLBACK de tudo), e os arquivos de anexo excluídos só saem do disco depois
     * do COMMIT. Na memória, roda direto (não há como desfazer).
     */
    emTransacao<T>(operacao: (factory: RepositoryFactoryInterface) => Promise<T>): Promise<T>;
}
