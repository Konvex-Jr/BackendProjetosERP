import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "./Http";
import UsuarioRoutes from "./Routes/UsuarioRoutes";
import ProjetoRoutes from "./Routes/ProjetoRoutes";
import TarefaRoutes from "./Routes/TarefaRoutes";
import CapacitacaoRoutes from "./Routes/CapacitacaoRoutes";
import CheckinRoutes from "./Routes/CheckinRoutes";
import PastaRoutes from "./Routes/PastaRoutes";
import DocumentoRoutes from "./Routes/DocumentoRoutes";
import ConfiguracaoRoutes from "./Routes/ConfiguracaoRoutes";
import swaggerSpecification from "./swagger";

export default class Router {
    private readonly routes: Array<{ init(): void }>;

    constructor(private readonly http: Http, private readonly repositoryFactory: RepositoryFactoryInterface) {
        this.routes = [
            new UsuarioRoutes(http, repositoryFactory),
            new ProjetoRoutes(http, repositoryFactory),
            new TarefaRoutes(http, repositoryFactory),
            new CapacitacaoRoutes(http, repositoryFactory),
            new CheckinRoutes(http, repositoryFactory),
            new PastaRoutes(http, repositoryFactory),
            new DocumentoRoutes(http, repositoryFactory),
            new ConfiguracaoRoutes(http, repositoryFactory),
        ];
    }

    init(): void {
        this.http.route("get", "/", false, async () => ({ message: "Bem vindo!" }));
        this.routes.forEach((routes) => routes.init());
        this.http.swagger(swaggerSpecification);
    }
}
