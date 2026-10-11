import RepositoryFactory from "../../../domain/Interfaces/RepositoryFactoryInterface";
import UsuarioController from "../../controller/UsuarioController";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";

export default class UsuarioRoutes implements ModelRoutes {

    protected usuarioController: UsuarioController;

    constructor(readonly http: Http, repositoryFactory: RepositoryFactory) {
        this.usuarioController = new UsuarioController(repositoryFactory);
    }

    init(): void {
        this.http.route("post", "/auth/register", false, async (params: any, body: any) => {
            return await this.usuarioController.criarUsuario(body);
        });

        this.http.route("post", "/auth/login", false, async (params: any, body: any) => {
            return this.usuarioController.login(body);
        });
    }
}