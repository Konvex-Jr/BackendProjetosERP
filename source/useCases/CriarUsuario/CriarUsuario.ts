import { hash } from "bcrypt";
import { sign } from "jsonwebtoken";
import { readFileSync } from "fs";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/Interfaces/UsuarioRepositoryInterface";
import Usuario from "../../domain/Entity/Usuario";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import CriarUsuarioInput from "./CriarUsuarioInput";
import CriarUsuarioOutput from "./CriarUsuarioOutput";

export default class CriarUsuario {
    readonly usuarioRepository: UsuarioRepositoryInterface;
    constructor(repositoryFactory: RepositoryFactoryInterface) {
        this.usuarioRepository = repositoryFactory.criarUsuarioRepository();
    }
    async execute(input: CriarUsuarioInput): Promise<CriarUsuarioOutput> {
        if (input.senha.length < 6) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.VALIDACAO.SENHA_CURTA, "SENHA_CURTA");
        }
        const email = input.email.trim().toLowerCase();
        const usuarioExistente = await this.usuarioRepository.buscarPorEmail(email);
        if (usuarioExistente) {
            throw new ErroValidacao("Já existe um usuário cadastrado com este e-mail.", "EMAIL_JA_CADASTRADO");
        }
        const senhaCriptografada = await hash(input.senha, 10);
        const usuario = new Usuario(input.nome, email, input.perfil, input.ativo ?? true, senhaCriptografada, input.senioridade ?? null);
        const usuarioCriado = await this.usuarioRepository.criar(usuario);
        if (!usuarioCriado) {
            throw new ErroValidacao("Já existe um usuário cadastrado com este e-mail.", "EMAIL_JA_CADASTRADO");
        }
        const chavePrivada = readFileSync("./private.key");
        const dadosToken = {
            codigo: usuario.codigo,
            email: usuario.email,
        };
        const token = sign(dadosToken, chavePrivada, {
            algorithm: "RS256",
            expiresIn: "2h",
        });
        return { token };
    }
}
