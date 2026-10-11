import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "./Http";
import UsuarioRoutes from "./Routes/UsuarioRoutes";
export default class Router {

	protected usuarioRoutes: UsuarioRoutes;

	constructor(readonly http: Http, readonly repositoryFactory: RepositoryFactoryInterface) {
		this.usuarioRoutes = new UsuarioRoutes(this.http, this.repositoryFactory);
	}

	init() {
		this.http.route("get", "/", true, async (params: any, body: any) => { return { message: "Bem vindo!" } });
		this.usuarioRoutes.init();
	}
}