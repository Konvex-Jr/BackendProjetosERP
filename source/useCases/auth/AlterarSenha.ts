import { compare, hash } from "bcrypt";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { validarNovaSenha } from "../../shared/seguranca/regraSenha";

/** Troca a própria senha: confere a atual, aplica a regra nova e encerra todas as sessões abertas. */
export default class AlterarSenha {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: { codigoUsuario: string; senhaAtual: unknown; novaSenha: unknown }): Promise<void> {
        const usuarios = this.factory.criarUsuarioRepository();
        const usuario = await usuarios.buscarPorCodigo(input.codigoUsuario);
        if (!usuario) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.USUARIO.NAO_ENCONTRADO);

        const confere = typeof input.senhaAtual === "string" && (await compare(input.senhaAtual, usuario.senha));
        if (!confere) throw new ErroValidacao("A senha atual não confere.", "SENHA_ATUAL_INCORRETA");

        const nova = validarNovaSenha(input.novaSenha);
        if (nova === input.senhaAtual) throw new ErroValidacao("A senha nova precisa ser diferente da atual.", "SENHA_IGUAL_ATUAL");

        const senha = await hash(nova, 10);
        await usuarios.editar(usuario.copiar({ senha }));
        await this.factory.criarRefreshTokenRepository().revogarTodosDoUsuario(usuario.codigo);
    }
}
