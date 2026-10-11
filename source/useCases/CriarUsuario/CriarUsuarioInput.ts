import PerfilUsuario from "../../domain/Enum/PerfilUsuario";
import SenioridadeUsuario from "../../domain/Entity/SenioridadeUsuario";
export default interface CriarUsuarioInput {
    nome: string;
    email: string;
    senha: string;
    perfil: PerfilUsuario;
    senioridade?: SenioridadeUsuario | null;
    ativo?: boolean;
}
