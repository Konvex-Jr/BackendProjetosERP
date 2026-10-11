import Checkin from "../../../domain/Entity/Checkin";
import CheckinRepositoryInterface from "../../../domain/Interfaces/CheckinRepositoryInterface";

export default class CheckinRepositoryMemory implements CheckinRepositoryInterface {
    private checkins: Checkin[];

    constructor() {
        this.checkins = [];
    }

    async criar(checkin: Checkin): Promise<Checkin> {
        const jaExiste = this.checkins.some(
            (c) =>
                c.usuario.codigo === checkin.usuario.codigo &&
                c.semana.getTime() === checkin.semana.getTime(),
        );

        if (jaExiste) {
            throw new Error("Já existe check-in deste usuário para a semana");
        }

        this.checkins.push(checkin);
        return checkin;
    }

    async editar(checkin: Checkin): Promise<Checkin> {
        const indice = this.checkins.findIndex((c) => c.codigo === checkin.codigo);

        if (indice === -1) {
            throw new Error("Check-in não encontrado");
        }

        this.checkins[indice] = checkin;
        return checkin;
    }

    async listar(): Promise<Checkin[]> {
        return [...this.checkins];
    }

    async listarPorUsuario(codigoUsuario: string): Promise<Checkin[]> {
        return this.checkins.filter((c) => c.usuario.codigo === codigoUsuario);
    }

    async buscarPorUsuarioESemana(
        codigoUsuario: string,
        semana: Date,
    ): Promise<Checkin | null> {
        return (
            this.checkins.find(
                (c) =>
                    c.usuario.codigo === codigoUsuario &&
                    c.semana.getTime() === semana.getTime(),
            ) ?? null
        );
    }
}
