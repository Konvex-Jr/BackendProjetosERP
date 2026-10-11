import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Capacitacao from "../../domain/Entity/Capacitacao";
import TipoCapacitacao from "../../domain/Enum/TipoCapacitacao";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export interface CriarCapacitacaoInput {
    titulo: string;
    data: Date;
    hora: string;
    codigoInstrutor: string;
    vagas: number;
    tipo: TipoCapacitacao;
    sala: string;
}

export default class CriarCapacitacao {
    private readonly capacitacoes;
    private readonly usuarios;
    constructor(factory: RepositoryFactoryInterface) {
        this.capacitacoes = factory.criarCapacitacaoRepository();
        this.usuarios = factory.criarUsuarioRepository();
    }

    async execute(input: CriarCapacitacaoInput): Promise<Capacitacao> {
        const instrutor = await this.usuarios.buscarPorCodigo(input.codigoInstrutor);
        if (!instrutor || !instrutor.ativo) {
            throw new ErroNaoEncontrado("O instrutor selecionado não existe ou está inativo.");
        }
        const capacitacao = new Capacitacao(
            input.titulo.trim(), input.data, input.hora, instrutor,
            Number(input.vagas), input.tipo, input.sala.trim(),
        );
        return this.capacitacoes.criar(capacitacao);
    }
}
