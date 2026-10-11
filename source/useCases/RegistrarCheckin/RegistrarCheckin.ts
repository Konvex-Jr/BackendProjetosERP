import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Checkin from "../../domain/Entity/Checkin";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroConflito } from "../../shared/erros/ErroConflito";
import RegistrarCheckinInput from "./RegistrarCheckinInput";

export default class RegistrarCheckin {
    private readonly checkins;
    private readonly usuarios;
    constructor(factory: RepositoryFactoryInterface) {
        this.checkins = factory.criarCheckinRepository();
        this.usuarios = factory.criarUsuarioRepository();
    }
    async execute(input: RegistrarCheckinInput): Promise<Checkin> {
        const u = await this.usuarios.buscarPorCodigo(input.codigoUsuario);
        if (!u || !u.ativo)
            throw new ErroNaoEncontrado("Usuário ativo não encontrado.");
        const semana = new Date(input.semana);
        semana.setUTCHours(0, 0, 0, 0);
        const existente = await this.checkins.buscarPorUsuarioESemana(u.codigo, semana);
        if (existente)
            throw new ErroConflito("Já existe check-in para esta semana.", "CHECKIN_JA_EXISTENTE");
        return this.checkins.criar(new Checkin(u, semana, input.resumo, input.aprendizados, input.humor ?? 3, input.sentimento ?? null));
    }
}
