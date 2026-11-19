import Projeto from "../entity/Projeto";
import StatusProjeto from "../enum/StatusProjeto";
import TipoProjeto from "../enum/TipoProjeto";

/** Filtros da lista de projetos. */
export interface FiltroProjetos {
    status?: StatusProjeto[];
    codigoArea?: string;
    codigoResponsavel?: string;
    busca?: string;
    tipo?: TipoProjeto;
}

/**
 * Projetos com a equipe (participações). Não aplica permissão: quem decide o que a pessoa vê é visibilidadeProjetos.
 * A equipe e a liderança do projeto geral da área nunca são gravadas: vêm dos períodos da área, montadas ao ler (sessão 23b).
 */
export default interface ProjetoRepositoryInterface {
    criar(projeto: Projeto): Promise<Projeto>;
    listar(filtro?: FiltroProjetos): Promise<Projeto[]>;
    /** Projetos em que a pessoa participa ou já participou, mais os gerais das áreas em que tem ou teve período, ou que lidera. */
    listarPorMembro(codigoUsuario: string): Promise<Projeto[]>;
    /** Projetos sigilosos em que a pessoa está na lista de acesso ou é a criadora. */
    listarComAcesso(codigoUsuario: string): Promise<Projeto[]>;
    /** Todos os projetos sigilosos. */
    listarSigilosos(): Promise<Projeto[]>;
    buscarPorCodigo(codigo: string): Promise<Projeto | null>;
    /** O projeto geral da área, com a equipe montada pelos períodos. */
    buscarGeralDaArea(codigoArea: string): Promise<Projeto | null>;
    /** Grava o projeto e suas participações. Participações nunca são apagadas, só encerradas. No geral, não grava participações nem líder. */
    editar(projeto: Projeto): Promise<Projeto>;
    excluir(codigo: string): Promise<void>;
    /** Trava a linha do projeto (FOR UPDATE) até o fim da transação: ninguém liga tarefa nova a ele. Fora de transação não segura nada. */
    travar(codigo: string): Promise<void>;
}
