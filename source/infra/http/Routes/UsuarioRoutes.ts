import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import UsuarioController from "../../controller/UsuarioController";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarUsuarios from "../../../useCases/ListarUsuarios/ListarUsuarios";
import EditarUsuario from "../../../useCases/EditarUsuario/EditarUsuario";
import InativarUsuario from "../../../useCases/InativarUsuario/InativarUsuario";
import SenioridadeUsuario from "../../../domain/Entity/SenioridadeUsuario";
import { exigirPodeGerirPerfil } from "../../../shared/seguranca/permissoes";
import { ErroProibido } from "../../../shared/erros/ErroProibido";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

export default class UsuarioRoutes implements ModelRoutes {
    protected readonly usuarioController: UsuarioController;

    constructor(
        readonly http: Http,
        private readonly repositoryFactory: RepositoryFactoryInterface,
    ) {
        this.usuarioController = new UsuarioController(repositoryFactory);
    }

    init(): void {
        // Não há cadastro público: contas são criadas por diretores e gerentes (RF-003, matriz de permissões).
        this.http.route("post", "/auth/login", false, async (_params: any, body: any) =>
            this.usuarioController.login(body));

        this.http.route("get", "/usuarios", true, async () =>
            new ListarUsuarios(this.repositoryFactory).execute());

        this.http.route("get", "/senioridades", true, async () =>
            this.repositoryFactory.criarSenioridadeRepository().listar());

        this.http.route("post", "/usuarios", true, async (_params: any, body: any) => {
            exigirPodeGerirPerfil(body.user, null, body.perfil);
            const senioridade = body.senioridade
                ? new SenioridadeUsuario(
                    body.senioridade.codigo,
                    body.senioridade.nome,
                    Number(body.senioridade.valorHora),
                )
                : null;

            return this.usuarioController.criarUsuario({ ...body, senioridade });
        });

        this.http.route("put", "/usuarios/:codigo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            exigirPodeGerirPerfil(body.user, alvo.perfil, body.perfil);
            const senioridade = body.senioridade
                ? new SenioridadeUsuario(
                    body.senioridade.codigo,
                    body.senioridade.nome,
                    Number(body.senioridade.valorHora),
                )
                : null;

            return new EditarUsuario(this.repositoryFactory).execute({
                codigo: params.codigo,
                nome: body.nome,
                email: body.email,
                perfil: body.perfil,
                senioridade,
            });
        });

        this.http.route("delete", "/usuarios/:codigo", true, async (params: any, body: any) => {
            const alvo = await this.buscarAlvo(params.codigo);
            const gestor = exigirPodeGerirPerfil(body.user, alvo.perfil, alvo.perfil);
            if (gestor.codigo === alvo.codigo) {
                throw new ErroProibido("Você não pode inativar a própria conta.");
            }
            return new InativarUsuario(this.repositoryFactory).execute(params.codigo);
        });
    }

    private async buscarAlvo(codigo: string) {
        const alvo = await this.repositoryFactory.criarUsuarioRepository().buscarPorCodigo(codigo);
        if (!alvo) throw new ErroNaoEncontrado("Usuário não encontrado.");
        return alvo;
    }
}
