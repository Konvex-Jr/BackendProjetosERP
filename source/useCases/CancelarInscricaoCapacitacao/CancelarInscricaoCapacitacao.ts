import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Capacitacao from "../../domain/Entity/Capacitacao";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";

export default class CancelarInscricaoCapacitacao {
    private readonly capacitacoes;
    private readonly usuarios;
    constructor(factory: RepositoryFactoryInterface) {
        this.capacitacoes = factory.criarCapacitacaoRepository();
        this.usuarios = factory.criarUsuarioRepository();
    }
    async execute(codigoCapacitacao: string, codigoUsuario: string): Promise<Capacitacao> {
        const c = await this.capacitacoes.buscarPorCodigo(codigoCapacitacao);
        if (!c)
            throw new ErroNaoEncontrado("Capacitação não encontrada.");
        const u = await this.usuarios.buscarPorCodigo(codigoUsuario);
        if (!u)
            throw new ErroNaoEncontrado("Usuário não encontrado.");
        if (!c.estaInscrito(u))
            throw new ErroValidacao("Usuário não está inscrito nesta capacitação.", "USUARIO_NAO_INSCRITO");
        const atualizada = new Capacitacao(c.titulo, c.data, c.hora, c.instrutor, c.vagas, c.tipo, c.sala, c.inscritos.filter(x => x.codigo !== u.codigo), c.codigo);
        return this.capacitacoes.editar(atualizada);
    }
}
