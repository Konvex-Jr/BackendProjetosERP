import PerfilUsuario from "../../domain/enum/PerfilUsuario";
import StatusPessoa from "../../domain/enum/StatusPessoa";
import SenioridadeUsuario from "../../domain/entity/SenioridadeUsuario";
import { EntradaPerfilPessoa } from "./dadosPessoa";

export default interface CriarUsuarioInput extends EntradaPerfilPessoa {
    nome: string;
    email: string;
    senha: string;
    perfil: PerfilUsuario;
    senioridade?: SenioridadeUsuario | null;
    /** Mantido por compatibilidade; prefira `status`. */
    ativo?: boolean;
    /** Ativo ou Trainee (padrão: Ativo). */
    status?: StatusPessoa;
    /** Quem está cadastrando, para o histórico de cargo e área. */
    codigoAutor?: string | null;
}
