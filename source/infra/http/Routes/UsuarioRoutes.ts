import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import UsuarioController from "../../controller/UsuarioController";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarUsuarios from "../../../useCases/ListarUsuarios/ListarUsuarios";
import EditarUsuario from "../../../useCases/EditarUsuario/EditarUsuario";
import InativarUsuario from "../../../useCases/InativarUsuario/InativarUsuario";

export default class UsuarioRoutes implements ModelRoutes {
    protected readonly usuarioController: UsuarioController;

    constructor(
        readonly http: Http,
        private readonly repositoryFactory: RepositoryFactoryInterface,
    ) {
        this.usuarioController = new UsuarioController(repositoryFactory);
    }

    init(): void {
        this.http.route("get", "/senioridades", false, async () =>
            this.repositoryFactory.criarSenioridadeRepository().listar());

        this.http.route("post", "/auth/register", false, async (_params: any, body: any) => {
            const senioridade = body.senioridade?.codigo
                ? await this.repositoryFactory.criarSenioridadeRepository().buscarPorCodigo(body.senioridade.codigo)
                : null;
            if (body.perfil === "membro" && body.senioridade?.codigo && !senioridade) {
                throw new Error("Código de senioridade inválido. Consulte GET /senioridades.");
            }
            return this.usuarioController.criarUsuario({ ...body, senioridade });
        });

        this.http.route("post", "/auth/login", false, async (_params: any, body: any) =>
            this.usuarioController.login(body));

        this.http.route("get", "/usuarios", true, async () =>
            new ListarUsuarios(this.repositoryFactory).execute());

        this.http.route("put", "/usuarios/:codigo", true, async (params: any, body: any) => {
            const senioridade = body.senioridade?.codigo
                ? await this.repositoryFactory.criarSenioridadeRepository().buscarPorCodigo(body.senioridade.codigo)
                : null;
            if (body.perfil === "membro" && body.senioridade?.codigo && !senioridade) {
                throw new Error("Código de senioridade inválido. Consulte GET /senioridades.");
            }

            return new EditarUsuario(this.repositoryFactory).execute({
                codigo: params.codigo,
                nome: body.nome,
                email: body.email,
                perfil: body.perfil,
                senioridade,
            });
        });

        this.http.route("delete", "/usuarios/:codigo", true, async (params: any) =>
            new InativarUsuario(this.repositoryFactory).execute(params.codigo));
    }
}
