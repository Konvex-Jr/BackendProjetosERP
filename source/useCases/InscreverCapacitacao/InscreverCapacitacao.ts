import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Capacitacao from "../../domain/Entity/Capacitacao";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroConflito } from "../../shared/erros/ErroConflito";

export default class InscreverCapacitacao {
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
        if (!u || !u.ativo)
            throw new ErroNaoEncontrado("Usuário ativo não encontrado.");
        if (c.estaInscrito(u))
            throw new ErroConflito("Usuário já está inscrito.", "USUARIO_JA_INSCRITO");
        if (!c.temVaga())
            throw new ErroConflito("Não há vagas disponíveis.", "CAPACITACAO_LOTADA");
        if (c.foiRealizada(new Date()))
            throw new ErroConflito("Não é possível se inscrever em uma capacitação realizada.", "CAPACITACAO_REALIZADA");
        const atualizada = new Capacitacao(c.titulo, c.data, c.hora, c.instrutor, c.vagas, c.tipo, c.sala, [...c.inscritos, u], c.codigo);
        return this.capacitacoes.editar(atualizada);
    }
}
