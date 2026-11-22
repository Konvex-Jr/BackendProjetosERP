import StatusProjeto from "../../domain/enum/StatusProjeto";
import { EntradaDetalhesProjeto } from "./dadosProjeto";

export default interface CriarProjetoInput extends EntradaDetalhesProjeto {
    nome: string;
    descricao: string;
    dataInicio: Date;
    dataFim: Date;
    status?: StatusProjeto;
    /** Pessoas que entram na equipe sem função nem alocação; detalhe pela aba Equipe. */
    codigosMembros?: string[];
    /** Quem está criando (a rota preenche). Só histórico: não dá acesso ao projeto (sessão 27a). */
    criadoPor?: string | null;
    sigiloso?: boolean;
    /** Líder (sessão 27b): ativo na EJ, não trainee; entra na equipe se não estiver em codigosMembros. */
    codigoLider?: string;
}
