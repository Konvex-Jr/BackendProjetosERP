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
import ConhecimentoRepositoryInterface from "./ConhecimentoRepositoryInterface";
import IniciativaRepositoryInterface from "./IniciativaRepositoryInterface";
import AnexoRepositoryInterface from "./AnexoRepositoryInterface";
import ArmazenamentoAnexosInterface from "./ArmazenamentoAnexosInterface";

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
    criarConhecimentoRepository(): ConhecimentoRepositoryInterface;
    criarIniciativaRepository(): IniciativaRepositoryInterface;
    criarAnexoRepository(): AnexoRepositoryInterface;
    /** Bytes dos anexos (disco em produção, memória nos testes). */
    criarArmazenamentoAnexos(): ArmazenamentoAnexosInterface;
}
