import { ErroConflito } from "../../shared/erros/ErroConflito";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/interfaces/UsuarioRepositoryInterface";
import Usuario from "../../domain/entity/Usuario";
import StatusPessoa, { STATUS_NA_EJ } from "../../domain/enum/StatusPessoa";
import { hoje } from "../../domain/entity/Participacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { exigirDominioKonvex, conferirCamposAlterados, exigirTraineeMembro, resolverPerfilPessoa } from "./dadosPessoa";
import GerirLinkSenha from "../auth/GerirLinkSenha";
import CriarUsuarioInput from "./CriarUsuarioInput";
import CriarUsuarioOutput from "./CriarUsuarioOutput";

/** RF-010: cadastra uma pessoa. Só diretores e gerentes chegam aqui (ver UsuarioRoutes). */
export default class CriarUsuario {
    readonly usuarioRepository: UsuarioRepositoryInterface;
    private readonly senioridadeRepository;

    constructor(private readonly repositoryFactory: RepositoryFactoryInterface) {
        this.usuarioRepository = repositoryFactory.criarUsuarioRepository();
        this.senioridadeRepository = repositoryFactory.criarSenioridadeRepository();
    }

    async execute(input: CriarUsuarioInput): Promise<CriarUsuarioOutput> {
        const email = String(input.email ?? "")
            .trim()
            .toLowerCase();
        exigirDominioKonvex(email);
        if (await this.usuarioRepository.buscarPorEmail(email)) {
            throw new ErroConflito(MENSAGENS_DE_ERRO.USUARIO.EMAIL_JA_CADASTRADO, "EMAIL_JA_CADASTRADO");
        }
        if (!input.senioridade?.codigo) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.VALIDACAO.SENIORIDADE_OBRIGATORIA, "SENIORIDADE_OBRIGATORIA");
        }
        const senioridade = await this.senioridadeRepository.buscarPorCodigo(input.senioridade.codigo);
        if (!senioridade) {
            throw new ErroNaoEncontrado("Senioridade não encontrada.");
        }

        const status = input.status ?? (input.ativo === false ? StatusPessoa.INATIVO : StatusPessoa.ATIVO);
        if (input.status && !STATUS_NA_EJ.includes(input.status)) {
            throw new ErroValidacao("Uma pessoa nova entra como Ativa ou Trainee.", "STATUS_INICIAL_INVALIDO");
        }

        exigirTraineeMembro(status, input.perfil);

        const detalhes = resolverPerfilPessoa(input);
        conferirCamposAlterados(null, { ...detalhes, status, dataEntrada: detalhes.dataEntrada ?? hoje() });
        const usuario = new Usuario(
            String(input.nome ?? "").trim(),
            email,
            input.perfil,
            status !== StatusPessoa.INATIVO,
            "", // sem senha: a pessoa define pelo link do convite
            senioridade,
            undefined,
            { ...detalhes, status, dataEntrada: detalhes.dataEntrada ?? hoje() },
        );

        const criado = await this.usuarioRepository.criar(usuario);
        if (!criado) {
            throw new ErroConflito(MENSAGENS_DE_ERRO.USUARIO.EMAIL_JA_CADASTRADO, "EMAIL_JA_CADASTRADO");
        }
        // Área e cargo são períodos, abertos depois pela gestão (sessão 23a): a pessoa nasce sem áreas.
        const conviteEnviado = usuario.ativo ? await new GerirLinkSenha(this.repositoryFactory).emitir(usuario, "convite") : false;
        return { usuario, conviteEnviado };
    }
}
