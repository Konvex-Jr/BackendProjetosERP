import { hash } from "bcrypt";
import { sign } from "jsonwebtoken";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/Interfaces/UsuarioRepositoryInterface";
import Usuario from "../../domain/Entity/Usuario";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import CriarUsuarioInput from "./CriarUsuarioInput";
import CriarUsuarioOutput from "./CriarUsuarioOutput";
import { obterChavePrivada } from "../../shared/seguranca/chavesJwt";

export default class CriarUsuario {
    readonly usuarioRepository: UsuarioRepositoryInterface;
    private readonly senioridadeRepository;

    constructor(repositoryFactory: RepositoryFactoryInterface) {
        this.usuarioRepository = repositoryFactory.criarUsuarioRepository();
        this.senioridadeRepository = repositoryFactory.criarSenioridadeRepository();
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
        let senioridade = input.senioridade ?? null;
        if (!senioridade) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.SENIORIDADE_OBRIGATORIA,
                "SENIORIDADE_OBRIGATORIA",
            );
        }
        if (senioridade) {
            const cadastrada = await this.senioridadeRepository.buscarPorCodigo(senioridade.codigo);
            if (!cadastrada) {
                throw new ErroNaoEncontrado("Senioridade não encontrada.");
            }
            senioridade = cadastrada;
        }

        const senhaCriptografada = await hash(input.senha, 10);
        const usuario = new Usuario(
            input.nome,
            email,
            input.perfil,
            input.ativo ?? true,
            senhaCriptografada,
            senioridade,
        );
        const usuarioCriado = await this.usuarioRepository.criar(usuario);
        if (!usuarioCriado) {
            throw new ErroValidacao("Já existe um usuário cadastrado com este e-mail.", "EMAIL_JA_CADASTRADO");
        }
        const chavePrivada = obterChavePrivada();
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
