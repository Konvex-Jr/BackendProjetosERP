import UsuarioRepositoryInterface from "./UsuarioRepositoryInterface";
import SenioridadeRepositoryInterface from "./SenioridadeRepositoryInterface";
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
    criarProjetoRepository(): ProjetoRepositoryInterface;
    criarTarefaRepository(): TarefaRepositoryInterface;
    criarColunaProjetoRepository(): ColunaProjetoRepositoryInterface;
    criarCapacitacaoRepository(): CapacitacaoRepositoryInterface;
    criarCapacitacaoFeedbackRepository(): CapacitacaoFeedbackRepositoryInterface;
    criarAreaRepository(): AreaRepositoryInterface;
    criarCargoRepository(): CargoRepositoryInterface;
    criarPeriodoAreaRepository(): PeriodoAreaRepositoryInterface;
    criarRefreshTokenRepository(): RefreshTokenRepositoryInterface;
    criarComentarioTarefaRepository(): ComentarioTarefaRepositoryInterface;
    criarBibliotecaRepository(): BibliotecaRepositoryInterface;
    criarAnexoRepository(): AnexoRepositoryInterface;
    /** Bytes dos anexos (disco em produção, memória nos testes). */
    criarArmazenamentoAnexos(): ArmazenamentoAnexosInterface;
    criarArmazenamentoFotos(): ArmazenamentoFotosInterface;
}
