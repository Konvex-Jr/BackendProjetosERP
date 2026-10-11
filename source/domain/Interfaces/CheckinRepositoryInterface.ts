import Checkin from "../Entity/Checkin";

export default interface CheckinRepositoryInterface {
    criar(checkin: Checkin): Promise<Checkin>;
    editar(checkin: Checkin): Promise<Checkin>;
    listar(): Promise<Checkin[]>;
    listarPorUsuario(codigoUsuario: string): Promise<Checkin[]>;
    buscarPorUsuarioESemana(codigoUsuario: string, semana: Date): Promise<Checkin | null>;
}
