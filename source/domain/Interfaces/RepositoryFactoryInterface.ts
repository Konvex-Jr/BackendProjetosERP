import UsuarioRepositoryInterface from "./UsuarioRepositoryInterface";
import SenioridadeRepositoryInterface from "./SenioridadeRepositoryInterface";
import ProjetoRepositoryInterface from "./ProjetoRepositoryInterface";
import TarefaRepositoryInterface from "./TarefaRepositoryInterface";
import CapacitacaoRepositoryInterface from "./CapacitacaoRepositoryInterface";
import CapacitacaoFeedbackRepositoryInterface from "./CapacitacaoFeedbackRepositoryInterface";
import PastaRepositoryInterface from "./PastaRepositoryInterface";
import DocumentoRepositoryInterface from "./DocumentoRepositoryInterface";
import AreaRepositoryInterface from "./AreaRepositoryInterface";
import CargoRepositoryInterface from "./CargoRepositoryInterface";
import HabilidadeRepositoryInterface from "./HabilidadeRepositoryInterface";
import HistoricoPessoaRepositoryInterface from "./HistoricoPessoaRepositoryInterface";
import RefreshTokenRepositoryInterface from "./RefreshTokenRepositoryInterface";
import ComentarioTarefaRepositoryInterface from "./ComentarioTarefaRepositoryInterface";

export default interface RepositoryFactoryInterface {
    criarUsuarioRepository(): UsuarioRepositoryInterface;
    criarSenioridadeRepository(): SenioridadeRepositoryInterface;
    criarProjetoRepository(): ProjetoRepositoryInterface;
    criarTarefaRepository(): TarefaRepositoryInterface;
    criarCapacitacaoRepository(): CapacitacaoRepositoryInterface;
    criarCapacitacaoFeedbackRepository(): CapacitacaoFeedbackRepositoryInterface;
    criarPastaRepository(): PastaRepositoryInterface;
    criarDocumentoRepository(): DocumentoRepositoryInterface;
    criarAreaRepository(): AreaRepositoryInterface;
    criarCargoRepository(): CargoRepositoryInterface;
    criarHabilidadeRepository(): HabilidadeRepositoryInterface;
    criarHistoricoPessoaRepository(): HistoricoPessoaRepositoryInterface;
    criarRefreshTokenRepository(): RefreshTokenRepositoryInterface;
    criarComentarioTarefaRepository(): ComentarioTarefaRepositoryInterface;
}
