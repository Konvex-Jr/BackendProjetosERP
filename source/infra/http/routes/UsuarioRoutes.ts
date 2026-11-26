import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import Http, { ContextoRequisicao } from "../Http";
import ModelRoutes from "./ModelRoutes";
import SenioridadeUsuario from "../../../domain/entity/SenioridadeUsuario";
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
import { EntradaPerfilPessoa, lerStatusPessoa, pendenciasPerfil } from "../../../useCases/pessoas/dadosPessoa";
import { exigirAutenticado, exigirPermissao, Permissao, UsuarioAutenticado } from "../../../shared/seguranca/permissoes";
import { AlvoDaHierarquia, exigirDarCargo, exigirGerirPessoa, podeGerirPessoa } from "../../../shared/seguranca/hierarquia";
import { permissoesEfetivas } from "../../../shared/seguranca/permissoesEfetivas";
import { lerData, lerDataObrigatoria, lerLista } from "../../../shared/entradas";
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
        ingresso: texto("ingresso"),
        dataEntrada: body.dataEntrada === undefined ? undefined : lerData(body.dataEntrada, "dataEntrada"),
        fimTrainee: body.fimTrainee === undefined ? undefined : lerData(body.fimTrainee, "fimTrainee"),
        bio: texto("bio"),
    };
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

    /** A própria pessoa (login, retomar, link de senha, /auth/me, perfil): com `pendenciasPerfil` para a tela bloquear. */
    private async responderEu(usuario: Usuario) {
        const pessoa = await this.responderPessoa(usuario);
        return { ...pessoa.toJSON(), pendenciasPerfil: pendenciasPerfil(usuario) };
    }

    private async comPendencias<T extends { usuario: Usuario }>(sessao: T) {
        return { ...sessao, usuario: await this.responderEu(sessao.usuario) };
    }

    /** A pessoa como a hierarquia a vê: o cargo atual dela (sessão 31a). */
    private async alvoNaHierarquia(alvo: Usuario): Promise<AlvoDaHierarquia> {
        const { cargo } = await permissoesEfetivas(alvo, this.repositoryFactory);
        return { codigo: alvo.codigo, cargo };
    }

    /** Posição do cargo atual de cada pessoa (período aberto com cargo), numa leitura só. */
    private async posicoesDosCargos(codigos: string[]): Promise<Map<string, { posicao: number }>> {
        const abertos = await this.repositoryFactory.criarPeriodoAreaRepository().listarAbertosDe(codigos);
        const cargos = new Map((await this.repositoryFactory.criarCargoRepository().listar()).map((c) => [c.codigo, c]));
        const posicoes = new Map<string, { posicao: number }>();
        for (const p of abertos) {
            const cargo = p.aberto && p.cargo ? cargos.get(p.cargo.codigo) : undefined;
            if (cargo) posicoes.set(p.codigoUsuario, { posicao: cargo.posicao });
        }
        return posicoes;
    }

    /** `pessoas.gerir` e a pessoa abaixo do seu cargo; devolve quem gere. */
    private async exigirGerir(usuario: UsuarioAutenticado | undefined, alvo: Usuario): Promise<UsuarioAutenticado> {
        return exigirGerirPessoa(usuario, await this.alvoNaHierarquia(alvo));
    }

    /** Período com cargo (31a): só cargos abaixo do seu. Cargo inexistente segue para o caso de uso (404). */
    private async exigirDarCargoDe(gestor: UsuarioAutenticado, codigoCargo: string | null | undefined): Promise<void> {
        if (!codigoCargo) return;
        exigirDarCargo(gestor, await this.repositoryFactory.criarCargoRepository().buscarPorCodigo(codigoCargo));
    }

    /** Alterar ou excluir um período: o cargo que ele tem hoje também precisa estar abaixo do seu. */
    private async exigirMexerNoPeriodo(gestor: UsuarioAutenticado, codigoPeriodo: string): Promise<void> {
        const periodo = await this.repositoryFactory.criarPeriodoAreaRepository().buscarPorCodigo(codigoPeriodo);
        exigirDarCargo(gestor, periodo?.cargo ?? null);
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
            return new RespostaComCookies(await this.comPendencias(sessao), [
                lembrete ? cookieLembrete(lembrete.token, lembrete.expiraEm) : apagarCookieLembrete(),
            ]);
        });

        // Aba sem sessão troca o lembrete do cookie por uma sessão própria e um cookie novo (mesmo prazo).
        // Falha responde 401 e apaga o cookie.
        this.http.route("post", "/auth/retomar", false, async (_p: any, _b: any, _q: any, contexto: ContextoRequisicao) => {
            try {
                const { sessao, lembrete } = await new RetomarSessao(f).execute(contexto?.cookies?.[NOME_COOKIE_LEMBRETE]);
                return new RespostaComCookies(await this.comPendencias(sessao), [cookieLembrete(lembrete.token, lembrete.expiraEm)]);
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
                return new RespostaComCookies(
                    await this.comPendencias(await new GerirLinkSenha(f).usar(params.token, body?.senha, body?.confirmacao)),
                    [apagarCookieLembrete()],
                );
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
            this.responderEu(await this.buscarAlvo(exigirAutenticado(body.user).codigo)),
        );

        this.http.route("put", "/auth/senha", true, async (_p: any, body: any) => {
            await new AlterarSenha(f).execute({
                codigoUsuario: exigirAutenticado(body.user).codigo,
                senhaAtual: body.senhaAtual,
                novaSenha: body.novaSenha,
            });
            return { message: "Senha alterada. Entre novamente nos outros dispositivos." };
        });

        // A própria pessoa edita os dados de contato, a apresentação e a data de entrada na EJ (25/11);
        // o resto (inclusive os períodos de área e cargo) é com a gestão.
        this.http.route("put", "/auth/perfil", true, async (_p: any, body: any) => {
            const eu = exigirAutenticado(body.user);
            const { nomeExibicao, telefone, linkedinUrl, calendarioUrl, githubUrl, curso, emailPessoal, ingresso, dataEntrada, bio } =
                lerPerfil(body);
            const editado = await new EditarUsuario(f).execute(
                {
                    codigo: eu.codigo,
                    nomeExibicao,
                    telefone,
                    linkedinUrl,
                    calendarioUrl,
                    githubUrl,
                    curso,
                    emailPessoal,
                    ingresso,
                    dataEntrada,
                    bio,
                },
                { autoEdicao: true },
            );
            return this.responderEu(editado);
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
        this.http.route("get", "/usuarios", true, async (_p: any, body: any, query: any) => {
            const pessoas = await new ListarUsuarios(f).execute({
                status: lerLista(query?.status).map((s) => lerStatusPessoa(s)!),
                codigoArea: query?.codigoArea || undefined,
                busca: query?.busca || undefined,
            });
            // Sessão 31a: a tela obedece a `podeGerir` (pessoas.gerir e a pessoa abaixo do cargo de quem olha).
            const posicoes = await this.posicoesDosCargos(pessoas.map((p) => p.codigo));
            return pessoas.map((p) => ({
                ...p.toJSON(),
                podeGerir: podeGerirPessoa(body.user, { codigo: p.codigo, cargo: posicoes.get(p.codigo) ?? null }),
            }));
        });

        this.http.route("get", "/usuarios/:codigo", true, async (params: any) =>
            this.responderPessoa(await this.buscarAlvo(params.codigo)),
        );

        this.http.route("get", "/usuarios/:codigo/perfil", true, async (params: any, body: any) => {
            const perfil = await new ObterPerfilPessoa(f).execute(params.codigo, exigirAutenticado(body.user));
            return { ...perfil, podeGerir: podeGerirPessoa(body.user, await this.alvoNaHierarquia(perfil.usuario)) };
        });

        // Períodos por área (sessão 23a): todos os logados leem, como o perfil; só a gestão grava.
        this.http.route("get", "/usuarios/:codigo/periodos", true, async (params: any, body: any) => {
            exigirAutenticado(body.user);
            return new GerirPeriodosArea(f).listar(params.codigo);
        });

        this.http.route("post", "/usuarios/:codigo/periodos", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = await this.exigirGerir(body.user, alvo);
            const entrada = lerPeriodo(body);
            await this.exigirDarCargoDe(gestor, entrada.codigoCargo);
            return new GerirPeriodosArea(f).criar(alvo.codigo, entrada, gestor.codigo);
        });

        this.http.route("put", "/usuarios/:codigo/periodos/:codigoPeriodo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = await this.exigirGerir(body.user, alvo);
            const entrada = lerPeriodo(body);
            await this.exigirMexerNoPeriodo(gestor, params.codigoPeriodo);
            await this.exigirDarCargoDe(gestor, entrada.codigoCargo);
            return new GerirPeriodosArea(f).editar(alvo.codigo, params.codigoPeriodo, entrada);
        });

        this.http.route("delete", "/usuarios/:codigo/periodos/:codigoPeriodo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = await this.exigirGerir(body.user, alvo);
            await this.exigirMexerNoPeriodo(gestor, params.codigoPeriodo);
            await new GerirPeriodosArea(f).excluir(alvo.codigo, params.codigoPeriodo);
            return new RespostaSemConteudo();
        });

        this.http.route("get", "/senioridades", true, async () => f.criarSenioridadeRepository().listar());

        this.http.route("post", "/usuarios", true, async (_p: any, body: any) => {
            // Pessoa nova entra sem cargo (abaixo de todos): basta gerir pessoas. O cargo vem depois, pelos períodos.
            exigirPermissao(body.user, Permissao.PESSOAS_GERIR, MENSAGENS_DE_ERRO.HIERARQUIA.SEM_GERIR_PESSOAS);
            const criado = await new CriarUsuario(f).execute({
                nome: body.nome,
                email: body.email,
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
            await this.exigirGerir(body.user, alvo);
            if (!alvo.ativo) throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.PESSOA_SEM_ACESSO, "PESSOA_SEM_ACESSO");
            const tipo = alvo.convitePendente ? "convite" : "redefinir";
            return { enviado: await new GerirLinkSenha(f).emitir(alvo, tipo), tipo };
        });

        this.http.route("put", "/usuarios/:codigo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            await this.exigirGerir(body.user, alvo);
            const editado = await new EditarUsuario(f).execute({
                codigo: alvo.codigo,
                nome: body.nome ?? alvo.nome,
                email: body.email ?? alvo.email,
                senioridade: lerSenioridade(body),
                ...lerPerfil(body),
            });
            return this.responderPessoa(editado);
        });

        this.http.route("patch", "/usuarios/:codigo/status", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = await this.exigirGerir(body.user, alvo);
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
            const gestor = await this.exigirGerir(body.user, alvo);
            if (gestor.codigo === alvo.codigo) throw new ErroProibido("Você não pode inativar a própria conta.");
            await new AlterarStatusPessoa(f).execute({ codigo: alvo.codigo, status: StatusPessoa.INATIVO, motivoSaida: body.motivoSaida });
            return { message: "Pessoa inativada. O histórico foi preservado." };
        });
    }
}
