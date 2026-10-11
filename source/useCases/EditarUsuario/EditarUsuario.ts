import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Usuario from "../../domain/Entity/Usuario";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroConflito } from "../../shared/erros/ErroConflito";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import EditarUsuarioInput from "./EditarUsuarioInput";

export default class EditarUsuario {
    private readonly usuarios;
    private readonly senioridades;
    constructor(factory: RepositoryFactoryInterface) {
        this.usuarios = factory.criarUsuarioRepository();
        this.senioridades = factory.criarSenioridadeRepository();
    }
    async execute(input: EditarUsuarioInput): Promise<Usuario> {
        const atual = await this.usuarios.buscarPorCodigo(input.codigo);
        if (!atual)
            throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.USUARIO.NAO_ENCONTRADO);
        const email = input.email.trim().toLowerCase();
        const porEmail = await this.usuarios.buscarPorEmail(email);
        if (porEmail && porEmail.codigo !== atual.codigo)
            throw new ErroConflito(MENSAGENS_DE_ERRO.USUARIO.EMAIL_JA_CADASTRADO, "EMAIL_JA_CADASTRADO");
        let senioridade = input.senioridade ?? atual.senioridade;
        if (!senioridade) {
            throw new ErroValidacao("Selecione uma senioridade cadastrada para o usuário.", "SENIORIDADE_OBRIGATORIA");
        }
        if (senioridade) {
            const cadastrada = await this.senioridades.buscarPorCodigo(senioridade.codigo);
            if (!cadastrada)
                throw new ErroNaoEncontrado("Senioridade não encontrada.");
            senioridade = cadastrada;
        }
        const editado = new Usuario(input.nome.trim(), email, input.perfil, atual.ativo, atual.senha, senioridade, atual.codigo);
        return this.usuarios.editar(editado);
    }
}
