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
    /** Quem está criando (a rota preenche). Mantém o acesso ao projeto sigiloso. */
    criadoPor?: string | null;
    sigiloso?: boolean;
    /** Códigos de quem vê o projeto sigiloso além da equipe. */
    acesso?: string[];
}
