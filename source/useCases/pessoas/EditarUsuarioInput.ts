import PerfilUsuario from "../../domain/enum/PerfilUsuario";
import SenioridadeUsuario from "../../domain/entity/SenioridadeUsuario";
import { EntradaPerfilPessoa } from "./dadosPessoa";

export default interface EditarUsuarioInput extends EntradaPerfilPessoa {
    codigo: string;
    nome?: string;
    email?: string;
    perfil?: PerfilUsuario;
    senioridade?: SenioridadeUsuario | null;
}
