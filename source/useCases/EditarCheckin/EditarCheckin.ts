import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Checkin from "../../domain/Entity/Checkin";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import EditarCheckinInput from "./EditarCheckinInput";

export default class EditarCheckin {
    private readonly checkins;
    private readonly usuarios;
    constructor(factory: RepositoryFactoryInterface) {
        this.checkins = factory.criarCheckinRepository();
        this.usuarios = factory.criarUsuarioRepository();
    }
    async execute(input: EditarCheckinInput): Promise<Checkin> {
        const u = await this.usuarios.buscarPorCodigo(input.codigoUsuario);
        if (!u)
            throw new ErroNaoEncontrado("Usuário não encontrado.");
        const semana = new Date(input.semana);
        semana.setUTCHours(0, 0, 0, 0);
        const atual = await this.checkins.buscarPorUsuarioESemana(u.codigo, semana);
        if (!atual)
            throw new ErroNaoEncontrado("Check-in da semana não encontrado.");
        return this.checkins.editar(new Checkin(u, semana, input.resumo, input.aprendizados, input.humor, input.sentimento ?? null, atual.codigo));
    }
}
