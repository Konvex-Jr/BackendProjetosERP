import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import Http, { ContextoRequisicao } from "../Http";
import ModelRoutes from "./ModelRoutes";
import SenioridadeUsuario from "../../../domain/entity/SenioridadeUsuario";
import PerfilUsuario from "../../../domain/enum/PerfilUsuario";
import StatusPessoa from "../../../domain/enum/StatusPessoa";
import LoginUsuario, { criarLimitesLogin } from "../../../useCases/auth/LoginUsuario";
import RenovarSessao from "../../../useCases/auth/RenovarSessao";
import RetomarSessao from "../../../useCases/auth/RetomarSessao";
import RespostaComCookies from "../RespostaComCookies";
import { apagarCookieLembrete, cookieLembrete, NOME_COOKIE_LEMBRETE } from "../../../shared/seguranca/cookieLembrete";
import EncerrarSessao from "../../../useCases/auth/EncerrarSessao";
import AlterarSenha from "../../../useCases/auth/AlterarSenha";
import GerirLinkSenha from "../../../useCases/auth/GerirLinkSenha";
import PedirRedefinicaoSenha, { criarLimitePedidosSenha } from "../../../useCases/auth/PedirRedefinicaoSenha";
import { LimiteTentativas } from "../../../shared/seguranca/limiteTentativas";
import { ErroMuitasTentativas } from "../../../shared/erros/ErroMuitasTentativas";
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
import { ErroValidacao } from "../../../shared/erros/ErroValidacao";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

/** Lê a senioridade enviada como objeto ({ codigo }) ou como texto (codigoSenioridade). */
function lerSenioridade(body: any): SenioridadeUsuario | null {
    const codigo = body.codigoSenioridade ?? body.senioridade?.codigo ?? (typeof body.senioridade === "string" ? body.senioridade : null);
    return codigo ? new SenioridadeUsuario(String(codigo), String(body.senioridade?.nome ?? codigo), 0) : null;
}

/** Campos do perfil presentes no corpo; ausentes ficam undefined (não alteram). */
function lerCodigoArea(valor: unknown): string {
    if (typeof valor !== "string" || !valor.trim()) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.PERIODO.AREA_OBRIGATORIA, "CAMPO_OBRIGATORIO");
    }
    return valor.trim();
}

function lerPeriodo(body: any): PeriodoAreaEntrada {
    return {
        codigoArea: lerCodigoArea(body?.codigoArea),
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
        emailPessoal: texto("emailPessoal"),
        semestre:
            body.semestre === undefined
                ? undefined
                : body.semestre === null || body.semestre === ""
                  ? null
                  : lerInteiro(body.semestre, "semestre"),
        dataEntrada: body.dataEntrada === undefined ? undefined : lerData(body.dataEntrada, "dataEntrada"),
        fimTrainee: body.fimTrainee === undefined ? undefined : lerData(body.fimTrainee, "fimTrainee"),
        bio: texto("bio"),
    };
}

/** Períodos de área: ninguém altera os próprios, exceto o diretor. Devolve quem gere. */
function exigirPodeGerirPeriodosDe(usuario: any, alvo: { codigo: string; perfil: PerfilUsuario | string }) {
    const gestor = exigirPodeGerirPerfil(usuario, alvo.perfil, alvo.perfil);
    if (gestor.codigo === alvo.codigo && gestor.perfil !== PerfilUsuario.DIRETOR) {
        throw new ErroProibido(MENSAGENS_DE_ERRO.PERIODO.PROPRIO);
    }
    return gestor;
}

function podeGerirPeriodosDe(usuario: any, alvo: { codigo: string; perfil: PerfilUsuario | string }): boolean {
    try {
        exigirPodeGerirPeriodosDe(usuario, alvo);
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
        // "Manter conectado": o cookie guarda só o lembrete; todo login certo troca ou apaga o cookie
        // (uma conta lembrada por navegador). O lembrete nunca vai no corpo.
        this.http.route("post", "/auth/login", false, async (_p: any, body: any, _q: any, contexto: ContextoRequisicao) => {
            const { lembrete, ...sessao } = await new LoginUsuario(f, limitesLogin).execute(
                { email: body?.email, senha: body?.senha, manterConectado: body?.manterConectado === true },
                contexto?.ip,
                contexto?.cookies?.[NOME_COOKIE_LEMBRETE],
            );
            return new RespostaComCookies(sessao, [lembrete ? cookieLembrete(lembrete.token, lembrete.expiraEm) : apagarCookieLembrete()]);
        });

        // Aba sem sessão troca o lembrete do cookie por uma sessão própria e um cookie novo (mesmo prazo).
        // Falha responde 401 e apaga o cookie.
        this.http.route("post", "/auth/retomar", false, async (_p: any, _b: any, _q: any, contexto: ContextoRequisicao) => {
            try {
                const { sessao, lembrete } = await new RetomarSessao(f).execute(contexto?.cookies?.[NOME_COOKIE_LEMBRETE]);
                return new RespostaComCookies(sessao, [cookieLembrete(lembrete.token, lembrete.expiraEm)]);
            } catch (erro) {
                if (!(erro instanceof ErroAplicacao)) throw erro;
                return new RespostaComCookies({ message: erro.message, codigo: erro.codigo }, [apagarCookieLembrete()], erro.codigoHttp);
            }
        });

        // Links de senha (convite e redefinição): rotas públicas; o token só vale uma vez.
        const limitePedidos = criarLimitePedidosSenha();
        const limiteLinks = new LimiteTentativas(20, 15 * 60 * 1000);
        this.http.route("post", "/auth/esqueci-senha", false, async (_p: any, body: any, _q: any, contexto: ContextoRequisicao) => {
            await new PedirRedefinicaoSenha(f, limitePedidos).execute(body?.email, contexto?.ip);
            return { message: "Se o e-mail estiver cadastrado, você vai receber um link em instantes." };
        });

        this.http.route("get", "/auth/link-senha/:token", false, async (params: any) => new GerirLinkSenha(f).consultar(params.token));

        this.http.route("post", "/auth/link-senha/:token", false, async (params: any, body: any, _q: any, contexto: ContextoRequisicao) => {
            const ip = contexto?.ip ?? "desconhecido";
            const espera = limiteLinks.segundosBloqueado(ip);
            if (espera > 0) {
                const minutos = Math.ceil(espera / 60);
                throw new ErroMuitasTentativas(`Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`);
            }
            try {
                // Usar o link revoga todas as sessões da pessoa: o cookie de lembrete sai junto.
                return new RespostaComCookies(await new GerirLinkSenha(f).usar(params.token, body?.senha, body?.confirmacao), [
                    apagarCookieLembrete(),
                ]);
            } catch (erro) {
                if (erro instanceof ErroValidacao) limiteLinks.registrarFalha(ip);
                throw erro;
            }
        });

        this.http.route("post", "/auth/refresh", false, async (_p: any, body: any) => new RenovarSessao(f).execute(body.refreshToken));

        this.http.route("post", "/auth/logout", false, async (_p: any, body: any, _q: any, contexto: ContextoRequisicao) => {
            await new EncerrarSessao(f).execute(body?.refreshToken, contexto?.cookies?.[NOME_COOKIE_LEMBRETE]);
            return new RespostaComCookies({ message: "Sessão encerrada." }, [apagarCookieLembrete()]);
        });

        this.http.route("get", "/auth/me", true, async (_p: any, body: any) =>
            this.responderPessoa(await this.buscarAlvo(exigirAutenticado(body.user).codigo)),
        );

        this.http.route("put", "/auth/senha", true, async (_p: any, body: any) => {
            await new AlterarSenha(f).execute({
                codigoUsuario: exigirAutenticado(body.user).codigo,
                senhaAtual: body.senhaAtual,
                novaSenha: body.novaSenha,
            });
            return { message: "Senha alterada. Entre novamente nos outros dispositivos." };
        });

        // A própria pessoa edita só os dados de contato e apresentação; o resto é com a gestão.
        this.http.route("put", "/auth/perfil", true, async (_p: any, body: any) => {
            const eu = exigirAutenticado(body.user);
            const { nomeExibicao, telefone, linkedinUrl, calendarioUrl, githubUrl, curso, emailPessoal, semestre, bio } = lerPerfil(body);
            const editado = await new EditarUsuario(f).execute({
                codigo: eu.codigo,
                nomeExibicao,
                telefone,
                linkedinUrl,
                calendarioUrl,
                githubUrl,
                curso,
                emailPessoal,
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
            return { ...perfil, podeGerirPeriodos: podeGerirPeriodosDe(body.user, perfil.usuario) };
        });

        // Períodos por área (sessão 23a): todos os logados leem, como o perfil; só a gestão grava.
        this.http.route("get", "/usuarios/:codigo/periodos", true, async (params: any, body: any) => {
            exigirAutenticado(body.user);
            return new GerirPeriodosArea(f).listar(params.codigo);
        });

        this.http.route("post", "/usuarios/:codigo/periodos", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = exigirPodeGerirPeriodosDe(body.user, alvo);
            return new GerirPeriodosArea(f).criar(alvo.codigo, lerPeriodo(body), gestor.codigo);
        });

        this.http.route("put", "/usuarios/:codigo/periodos/:codigoPeriodo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            exigirPodeGerirPeriodosDe(body.user, alvo);
            return new GerirPeriodosArea(f).editar(alvo.codigo, params.codigoPeriodo, lerPeriodo(body));
        });

        this.http.route("delete", "/usuarios/:codigo/periodos/:codigoPeriodo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            exigirPodeGerirPeriodosDe(body.user, alvo);
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
                perfil,
                senioridade: lerSenioridade(body),
                status: lerStatusPessoa(body.status),
                ...lerPerfil(body),
            });
            const pessoa = await this.responderPessoa(criado.usuario);
            return { ...pessoa.toJSON(), conviteEnviado: criado.conviteEnviado };
        });

        // Reenvia o convite (quem ainda não definiu senha) ou manda link de redefinição. A gestão nunca vê a senha nem o link.
        this.http.route("post", "/usuarios/:codigo/link-senha", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            exigirPodeGerirPerfil(body.user, alvo.perfil, alvo.perfil);
            if (!alvo.ativo) throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.PESSOA_SEM_ACESSO, "PESSOA_SEM_ACESSO");
            const tipo = alvo.convitePendente ? "convite" : "redefinir";
            return { enviado: await new GerirLinkSenha(f).emitir(alvo, tipo), tipo };
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
                motivoSaida: body.motivoSaida,
                encerrarParticipacoes: body.encerrarParticipacoes !== false,
            });
            // Trainee que vira Ativo continua nas áreas: a resposta traz as atuais.
            return { ...resultado, usuario: await this.responderPessoa(resultado.usuario) };
        });

        // Compatibilidade: DELETE não exclui, só muda o status para Inativo (ADR-006).
        this.http.route("delete", "/usuarios/:codigo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = exigirPodeGerirPerfil(body.user, alvo.perfil, alvo.perfil);
            if (gestor.codigo === alvo.codigo) throw new ErroProibido("Você não pode inativar a própria conta.");
            await new AlterarStatusPessoa(f).execute({ codigo: alvo.codigo, status: StatusPessoa.INATIVO, motivoSaida: body.motivoSaida });
            return { message: "Pessoa inativada. O histórico foi preservado." };
        });
    }
}
