import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import CapacitacaoFeedback from "../../domain/Entity/CapacitacaoFeedback";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import EnviarFeedbackCapacitacaoInput from "./EnviarFeedbackCapacitacaoInput";

export default class EnviarFeedbackCapacitacao {
    private readonly capacitacoes;
    private readonly usuarios;
    private readonly feedbacks;
    constructor(factory: RepositoryFactoryInterface) {
        this.capacitacoes = factory.criarCapacitacaoRepository();
        this.usuarios = factory.criarUsuarioRepository();
        this.feedbacks = factory.criarCapacitacaoFeedbackRepository();
    }
    async execute(input: EnviarFeedbackCapacitacaoInput): Promise<CapacitacaoFeedback> {
        const c = await this.capacitacoes.buscarPorCodigo(input.codigoCapacitacao);
        if (!c)
            throw new ErroNaoEncontrado("Capacitação não encontrada.");
        const u = await this.usuarios.buscarPorCodigo(input.codigoUsuario);
        if (!u)
            throw new ErroNaoEncontrado("Usuário não encontrado.");
        const data = input.data ?? new Date();
        const existente = await this.feedbacks.buscarPorCapacitacaoEUsuario(c.codigo, u.codigo);
        const feedback = new CapacitacaoFeedback(c, u, input.nota, data, input.bom ?? null, input.melhorar ?? null, existente?.codigo);
        return existente ? this.feedbacks.editar(feedback) : this.feedbacks.criar(feedback);
    }
}
