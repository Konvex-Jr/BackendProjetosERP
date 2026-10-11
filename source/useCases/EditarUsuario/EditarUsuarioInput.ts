import PerfilUsuario from "../../domain/Enum/PerfilUsuario";
import SenioridadeUsuario from "../../domain/Entity/SenioridadeUsuario";
export default interface EditarUsuarioInput {
    codigo: string;
    nome: string;
    email: string;
    perfil: PerfilUsuario;
    senioridade?: SenioridadeUsuario | null;
}
