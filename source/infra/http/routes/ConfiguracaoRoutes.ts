import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import SalvarArea from "../../../useCases/config/SalvarArea";
import GerirPermissoes from "../../../useCases/config/GerirPermissoes";
import SalvarCargo from "../../../useCases/config/SalvarCargo";
import SalvarHorasDificuldade from "../../../useCases/config/SalvarHorasDificuldade";
import SalvarRegrasPrecificacao from "../../../useCases/config/SalvarRegrasPrecificacao";
import SalvarSenioridade from "../../../useCases/config/SalvarSenioridade";
import SalvarClasseProjeto from "../../../useCases/config/SalvarClasseProjeto";
import { exigirPermissao, Permissao } from "../../../shared/seguranca/permissoes";
import { lerBooleano, lerInteiro } from "../../../shared/entradas";

const SO_DIRETOR = "Você não tem permissão para configurar áreas, cargos, senioridades e classes de projeto.";

/** Configurações (ADR-007): leitura para todos, escrita só para diretores (ADMIN). */
export default class ConfiguracaoRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    init(): void {
        const f = this.factory;

        this.http.route("get", "/areas", true, async () => f.criarAreaRepository().listar());
        this.http.route("post", "/areas", true, async (_p: any, body: any) => {
            exigirPermissao(body.user, Permissao.CONFIG_ESTRUTURA, SO_DIRETOR);
            return new SalvarArea(f).execute({
                nome: body.nome,
                codigoAreaPai: body.codigoAreaPai,
                ativa: body.ativa,
                temGeral: lerBooleano(body.temGeral, "temGeral"),
            });
        });
        this.http.route("put", "/areas/:codigo", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.CONFIG_ESTRUTURA, SO_DIRETOR);
            return new SalvarArea(f).execute({
                codigo: params.codigo,
                nome: body.nome,
                codigoAreaPai: body.codigoAreaPai,
                ativa: body.ativa,
                temGeral: lerBooleano(body.temGeral, "temGeral"),
            });
        });

        this.http.route("get", "/cargos", true, async () => f.criarCargoRepository().listar());
        this.http.route("post", "/cargos", true, async (_p: any, body: any) => {
            const quem = exigirPermissao(body.user, Permissao.CONFIG_ESTRUTURA, SO_DIRETOR);
            return new SalvarCargo(f).execute({
                nome: body.nome,
                ativo: body.ativo,
                lideraArea: lerBooleano(body.lideraArea, "lideraArea"),
                tetoSemanalHoras: lerInteiro(body.tetoSemanalHoras, "tetoSemanalHoras"),
                posicao: lerInteiro(body.posicao, "posicao"),
                quem,
            });
        });
        this.http.route("put", "/cargos/:codigo", true, async (params: any, body: any) => {
            const quem = exigirPermissao(body.user, Permissao.CONFIG_ESTRUTURA, SO_DIRETOR);
            return new SalvarCargo(f).execute({
                codigo: params.codigo,
                nome: body.nome,
                ativo: body.ativo,
                lideraArea: lerBooleano(body.lideraArea, "lideraArea"),
                tetoSemanalHoras: lerInteiro(body.tetoSemanalHoras, "tetoSemanalHoras"),
                posicao: lerInteiro(body.posicao, "posicao"),
                quem,
            });
        });

        // Grade de permissões (sessão 31a): quem tem permissoes.gerir; altera só o que está abaixo do seu cargo.
        this.http.route("get", "/permissoes", true, async (_p: any, body: any) => new GerirPermissoes(f).grade(body.user));
        this.http.route("put", "/permissoes/:chave", true, async (params: any, body: any) =>
            new GerirPermissoes(f).salvarColuna(body.user, params.chave, body.permissoes),
        );

        this.http.route("get", "/config/horas-dificuldade", true, async () => f.criarHorasDificuldadeRepository().listar());
        this.http.route("put", "/config/horas-dificuldade", true, async (_p: any, body: any) => {
            const { user, ...horas } = body;
            return new SalvarHorasDificuldade(f).execute({ horas, quem: user });
        });

        this.http.route("get", "/config/precificacao", true, async (_p: any, body: any) =>
            new SalvarRegrasPrecificacao(f).obter(body.user),
        );
        this.http.route("put", "/config/precificacao", true, async (_p: any, body: any) => {
            const { user, ...regras } = body;
            return new SalvarRegrasPrecificacao(f).execute({ regras, quem: user });
        });

        // Classes de projeto (sessão 31b): todos leem (formulário do projeto); escreve quem configura a estrutura.
        this.http.route("get", "/classes-projeto", true, async () => f.criarClasseProjetoRepository().listar());
        this.http.route("post", "/classes-projeto", true, async (_p: any, body: any) => {
            exigirPermissao(body.user, Permissao.CONFIG_ESTRUTURA, SO_DIRETOR);
            return new SalvarClasseProjeto(f).execute({ nome: body.nome, ordem: lerInteiro(body.ordem, "ordem") });
        });
        this.http.route("put", "/classes-projeto/:codigo", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.CONFIG_ESTRUTURA, SO_DIRETOR);
            return new SalvarClasseProjeto(f).execute({ codigo: params.codigo, nome: body.nome, ordem: lerInteiro(body.ordem, "ordem") });
        });

        this.http.route("post", "/senioridades", true, async (_p: any, body: any) => {
            exigirPermissao(body.user, Permissao.CONFIG_ESTRUTURA, SO_DIRETOR);
            return new SalvarSenioridade(f).execute({ nome: body.nome, ordem: lerInteiro(body.ordem, "ordem") });
        });
        this.http.route("put", "/senioridades/:codigo", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.CONFIG_ESTRUTURA, SO_DIRETOR);
            return new SalvarSenioridade(f).execute({ codigo: params.codigo, nome: body.nome, ordem: lerInteiro(body.ordem, "ordem") });
        });
    }
}
