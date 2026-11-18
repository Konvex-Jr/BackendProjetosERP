import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import Http, { ContextoRequisicao } from "../Http";
import ModelRoutes from "./ModelRoutes";
import SenioridadeUsuario from "../../../domain/entity/SenioridadeUsuario";
import PerfilUsuario from "../../../domain/enum/PerfilUsuario";
import StatusPessoa from "../../../domain/enum/StatusPessoa";
import LoginUsuario, { criarLimitesLogin } from "../../../useCases/auth/LoginUsuario";
import RenovarSessao from "../../../useCases/auth/RenovarSessao";
import EncerrarSessao from "../../../useCases/auth/EncerrarSessao";
import AlterarSenha from "../../../useCases/auth/AlterarSenha";
import CriarUsuario from "../../../useCases/pessoas/CriarUsuario";
import EditarUsuario from "../../../useCases/pessoas/EditarUsuario";
import ListarUsuarios from "../../../useCases/pessoas/ListarUsuarios";
import AlterarStatusPessoa from "../../../useCases/pessoas/AlterarStatusPessoa";
import GerirFotoPerfil, { TAMANHO_MAXIMO_FOTO } from "../../../useCases/pessoas/GerirFotoPerfil";
import RespostaArquivo from "../RespostaArquivo";
import RespostaSemConteudo from "../RespostaSemConteudo";
import ObterPerfilPessoa from "../../../useCases/pessoas/ObterPerfilPessoa";
import GerirPeriodosArea, { PeriodoAreaEntrada } from "../../../useCases/pessoas/GerirPeriodosArea";
import { comAreasAtuais } from "../../../useCases/pessoas/areasAtuais";
import Usuario from "../../../domain/entity/Usuario";
import { EntradaPerfilPessoa, lerStatusPessoa } from "../../../useCases/pessoas/dadosPessoa";
import { exigirAutenticado, exigirPodeGerirPerfil } from "../../../shared/seguranca/permissoes";
import { lerData, lerDataObrigatoria, lerEnum, lerInteiro, lerLista } from "../../../shared/entradas";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import { ErroProibido } from "../../../shared/erros/ErroProibido";
import { ErroAplicacao } from "../../../shared/erros/ErroAplicacao";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

/** Lê a senioridade enviada como objeto ({ codigo }) ou como texto (codigoSenioridade). */
function lerSenioridade(body: any): SenioridadeUsuario | null {
    const codigo = body.codigoSenioridade ?? body.senioridade?.codigo ?? (typeof body.senioridade === "string" ? body.senioridade : null);
    return codigo ? new SenioridadeUsuario(String(codigo), String(body.senioridade?.nome ?? codigo), 0) : null;
}

/** Campos do perfil presentes no corpo; ausentes ficam undefined (não alteram). */
function lerPeriodo(body: any): PeriodoAreaEntrada {
    return {
        codigoArea: String(body?.codigoArea ?? ""),
        codigoCargo: body?.codigoCargo ? String(body.codigoCargo) : null,
        inicio: lerDataObrigatoria(body?.inicio, "inicio"),
        fim: lerData(body?.fim, "fim"),
    };
}

function lerPerfil(body: any): EntradaPerfilPessoa {
    const texto = (campo: string) => (body[campo] === undefined ? undefined : body[campo]);
    return {
        nomeExibicao: texto("nomeExibicao"),
        telefone: texto("telefone"),
        linkedinUrl: texto("linkedinUrl"),
        calendarioUrl: texto("calendarioUrl"),
        githubUrl: texto("githubUrl"),
        curso: texto("curso"),
        semestre:
            body.semestre === undefined
                ? undefined
                : body.semestre === null || body.semestre === ""
                  ? null
                  : lerInteiro(body.semestre, "semestre"),
        dataEntrada: body.dataEntrada === undefined ? undefined : lerData(body.dataEntrada, "dataEntrada"),
        bio: texto("bio"),
    };
}

/** A pessoa logada pode gerir o perfil (e os períodos) de alguém com este papel? */
function podeGerirPerfilDe(usuario: any, perfilDoAlvo: PerfilUsuario | string): boolean {
    try {
        exigirPodeGerirPerfil(usuario, perfilDoAlvo, perfilDoAlvo);
        return true;
    } catch (erro) {
        if (erro instanceof ErroAplicacao) return false;
        throw erro;
    }
}

/** Rotas de sessão (RF-001) e de pessoas (RF-010 a RF-016). */
export default class UsuarioRoutes implements ModelRoutes {
    constructor(
        readonly http: Http,
        private readonly repositoryFactory: RepositoryFactoryInterface,
    ) {}

    /** A pessoa com as áreas atuais, como as rotas a devolvem. */
    private async responderPessoa(usuario: Usuario): Promise<Usuario> {
        return comAreasAtuais(this.repositoryFactory, usuario);
    }

    private async buscarAlvo(codigo: string) {
        const alvo = await this.repositoryFactory.criarUsuarioRepository().buscarPorCodigo(codigo);
        if (!alvo) throw new ErroNaoEncontrado("Usuário não encontrado.");
        return alvo;
    }

    init(): void {
        const f = this.repositoryFactory;

        // Sessão. Não há cadastro público: contas são criadas por diretores e gerentes.
        // Os limites ficam aqui (um por servidor), porque o caso de uso é criado a cada requisição.
        const limitesLogin = criarLimitesLogin();
        this.http.route("post", "/auth/login", false, async (_p: any, body: any, _q: any, contexto: ContextoRequisicao) =>
            new LoginUsuario(f, limitesLogin).execute({ email: body?.email, senha: body?.senha }, contexto?.ip),
        );

        this.http.route("post", "/auth/refresh", false, async (_p: any, body: any) => new RenovarSessao(f).execute(body.refreshToken));

        this.http.route("post", "/auth/logout", false, async (_p: any, body: any) => {
            await new EncerrarSessao(f).execute(body.refreshToken);
            return { message: "Sessão encerrada." };
        });

        this.http.route("get", "/auth/me", true, async (_p: any, body: any) =>
            this.responderPessoa(await this.buscarAlvo(exigirAutenticado(body.user).codigo)),
        );

        this.http.route("put", "/auth/senha", true, async (_p: any, body: any) => {
            await new AlterarSenha(f).execute({
                codigoUsuario: exigirAutenticado(body.user).codigo,
                senhaAtual: body.senhaAtual,
                novaSenha: body.novaSenha,
                exigirSenhaAtual: true,
            });
            return { message: "Senha alterada. Entre novamente nos outros dispositivos." };
        });

        // A própria pessoa edita só os dados de contato e apresentação; o resto é com a gestão.
        this.http.route("put", "/auth/perfil", true, async (_p: any, body: any) => {
            const eu = exigirAutenticado(body.user);
            const { nomeExibicao, telefone, linkedinUrl, calendarioUrl, githubUrl, curso, semestre, bio } = lerPerfil(body);
            const editado = await new EditarUsuario(f).execute({
                codigo: eu.codigo,
                nomeExibicao,
                telefone,
                linkedinUrl,
                calendarioUrl,
                githubUrl,
                curso,
                semestre,
                bio,
            });
            return this.responderPessoa(editado);
        });

        // Foto de perfil: JPEG, PNG ou WebP já recortado no navegador (até 300 KB); o servidor
        // regrava em WebP 256x256. A leitura é pública:
        // o nome do arquivo é um UUID, e a tela precisa dela em <img>, que não manda o token.
        this.http.route(
            "put",
            "/auth/foto",
            true,
            async (_p: any, body: any) => new GerirFotoPerfil(f).trocar(exigirAutenticado(body.user).codigo, body.arquivo.conteudo),
            {
                arquivo: {
                    limiteBytes: TAMANHO_MAXIMO_FOTO,
                    mensagemLimite: MENSAGENS_DE_ERRO.FOTO.GRANDE_DEMAIS,
                    codigoLimite: "FOTO_GRANDE_DEMAIS",
                },
            },
        );

        this.http.route("delete", "/auth/foto", true, async (_p: any, body: any) => {
            await new GerirFotoPerfil(f).remover(exigirAutenticado(body.user).codigo);
            return new RespostaSemConteudo();
        });

        this.http.route("get", "/fotos/:arquivo", false, async (params: any) => {
            const aberta = await f.criarArmazenamentoFotos().abrir(String(params.arquivo));
            if (!aberta) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.FOTO.NAO_ENCONTRADA);
            return new RespostaArquivo(params.arquivo, "image/webp", aberta.fluxo, aberta.tamanho, { publica: true });
        });

        // Pessoas: todos os autenticados consultam; só gestores alteram (matriz de permissões).
        this.http.route("get", "/usuarios", true, async (_p: any, _b: any, query: any) =>
            new ListarUsuarios(f).execute({
                status: lerLista(query?.status).map((s) => lerStatusPessoa(s)!),
                codigoArea: query?.codigoArea || undefined,
                busca: query?.busca || undefined,
            }),
        );

        this.http.route("get", "/usuarios/:codigo", true, async (params: any) =>
            this.responderPessoa(await this.buscarAlvo(params.codigo)),
        );

        this.http.route("get", "/usuarios/:codigo/perfil", true, async (params: any, body: any) => {
            const perfil = await new ObterPerfilPessoa(f).execute(params.codigo, exigirAutenticado(body.user));
            return { ...perfil, podeGerirPeriodos: podeGerirPerfilDe(body.user, perfil.usuario.perfil) };
        });

        // Períodos por área (sessão 23a): todos os logados leem, como o perfil; só a gestão grava.
        this.http.route("get", "/usuarios/:codigo/periodos", true, async (params: any, body: any) => {
            exigirAutenticado(body.user);
            return new GerirPeriodosArea(f).listar(params.codigo);
        });

        this.http.route("post", "/usuarios/:codigo/periodos", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = exigirPodeGerirPerfil(body.user, alvo.perfil, alvo.perfil);
            return new GerirPeriodosArea(f).criar(alvo.codigo, lerPeriodo(body), gestor.codigo);
        });

        this.http.route("put", "/usuarios/:codigo/periodos/:codigoPeriodo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            exigirPodeGerirPerfil(body.user, alvo.perfil, alvo.perfil);
            return new GerirPeriodosArea(f).editar(alvo.codigo, params.codigoPeriodo, lerPeriodo(body));
        });

        this.http.route("delete", "/usuarios/:codigo/periodos/:codigoPeriodo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            exigirPodeGerirPerfil(body.user, alvo.perfil, alvo.perfil);
            await new GerirPeriodosArea(f).excluir(alvo.codigo, params.codigoPeriodo);
            return new RespostaSemConteudo();
        });

        this.http.route("get", "/senioridades", true, async () => f.criarSenioridadeRepository().listar());

        this.http.route("post", "/usuarios", true, async (_p: any, body: any) => {
            const perfil = lerEnum(body.perfil, PerfilUsuario, "perfil") ?? PerfilUsuario.MEMBRO;
            exigirPodeGerirPerfil(body.user, null, perfil);
            const criado = await new CriarUsuario(f).execute({
                nome: body.nome,
                email: body.email,
                senha: body.senha,
                perfil,
                senioridade: lerSenioridade(body),
                status: lerStatusPessoa(body.status),
                ...lerPerfil(body),
            });
            return this.responderPessoa(criado);
        });

        this.http.route("put", "/usuarios/:codigo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const perfil = lerEnum(body.perfil, PerfilUsuario, "perfil") ?? alvo.perfil;
            const gestor = exigirPodeGerirPerfil(body.user, alvo.perfil, perfil);
            if (gestor.codigo === alvo.codigo && perfil !== alvo.perfil) {
                throw new ErroProibido("Você não pode alterar o próprio perfil de acesso.");
            }
            const editado = await new EditarUsuario(f).execute({
                codigo: alvo.codigo,
                nome: body.nome ?? alvo.nome,
                email: body.email ?? alvo.email,
                perfil,
                senioridade: lerSenioridade(body),
                ...lerPerfil(body),
            });
            return this.responderPessoa(editado);
        });

        this.http.route("patch", "/usuarios/:codigo/status", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = exigirPodeGerirPerfil(body.user, alvo.perfil, alvo.perfil);
            if (gestor.codigo === alvo.codigo) throw new ErroProibido("Você não pode alterar o próprio status.");
            const resultado = await new AlterarStatusPessoa(f).execute({
                codigo: alvo.codigo,
                status: lerStatusPessoa(body.status)!,
                dataSaida: lerData(body.dataSaida, "dataSaida"),
                encerrarParticipacoes: body.encerrarParticipacoes !== false,
            });
            // Trainee que vira Ativo continua nas áreas: a resposta traz as atuais.
            return { ...resultado, usuario: await this.responderPessoa(resultado.usuario) };
        });

        this.http.route("put", "/usuarios/:codigo/senha", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            exigirPodeGerirPerfil(body.user, alvo.perfil, alvo.perfil);
            await new AlterarSenha(f).execute({ codigoUsuario: alvo.codigo, novaSenha: body.novaSenha, exigirSenhaAtual: false });
            return { message: "Senha redefinida." };
        });

        // Compatibilidade: DELETE não exclui, só muda o status para Inativo (ADR-006).
        this.http.route("delete", "/usuarios/:codigo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = exigirPodeGerirPerfil(body.user, alvo.perfil, alvo.perfil);
            if (gestor.codigo === alvo.codigo) throw new ErroProibido("Você não pode inativar a própria conta.");
            await new AlterarStatusPessoa(f).execute({ codigo: alvo.codigo, status: StatusPessoa.INATIVO });
            return { message: "Pessoa inativada. O histórico foi preservado." };
        });
    }
}
