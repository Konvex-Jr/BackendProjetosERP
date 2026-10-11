import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import UsuarioController from "../../controller/UsuarioController";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarUsuarios from "../../../useCases/ListarUsuarios/ListarUsuarios";
import EditarUsuario from "../../../useCases/EditarUsuario/EditarUsuario";
import InativarUsuario from "../../../useCases/InativarUsuario/InativarUsuario";
import SenioridadeUsuario from "../../../domain/Entity/SenioridadeUsuario";

export default class UsuarioRoutes implements ModelRoutes {
    protected readonly usuarioController: UsuarioController;

    constructor(
        readonly http: Http,
        private readonly repositoryFactory: RepositoryFactoryInterface,
    ) {
        this.usuarioController = new UsuarioController(repositoryFactory);
    }

    init(): void {
        this.http.route("post", "/auth/register", false, async (_params: any, body: any) => {
            const senioridade = body.senioridade
                ? new SenioridadeUsuario(
                    body.senioridade.codigo,
                    body.senioridade.nome,
                    Number(body.senioridade.valorHora),
                )
                : null;

            return this.usuarioController.criarUsuario({ ...body, senioridade });
        });

        this.http.route("post", "/auth/login", false, async (_params: any, body: any) =>
            this.usuarioController.login(body));

        this.http.route("get", "/usuarios", true, async () =>
            new ListarUsuarios(this.repositoryFactory).execute());

        this.http.route("put", "/usuarios/:codigo", true, async (params: any, body: any) => {
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

        this.http.route("delete", "/usuarios/:codigo", true, async (params: any) =>
            new InativarUsuario(this.repositoryFactory).execute(params.codigo));
    }
}
