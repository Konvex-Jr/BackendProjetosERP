import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Checkin from "../../domain/Entity/Checkin";

export default class ListarCheckins {
    private readonly checkins;
    constructor(factory: RepositoryFactoryInterface) {
        this.checkins = factory.criarCheckinRepository();
    }
    async execute(codigoUsuario?: string): Promise<Checkin[]> {
        return codigoUsuario ? this.checkins.listarPorUsuario(codigoUsuario) : this.checkins.listar();
    }
}
