import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ConsultarAvisos from "../../../useCases/avisos/ConsultarAvisos";
import { exigirAutenticado } from "../../../shared/seguranca/permissoes";

/** Central de avisos (sessão 26a): de todo logado; sem permissão no catálogo. */
export default class AvisoRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    init(): void {
        this.http.route("get", "/avisos", true, async (_params: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            return new ConsultarAvisos(this.factory).listar(usuario);
        });

        this.http.route("patch", "/avisos/lidos", true, async (_params: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            return new ConsultarAvisos(this.factory).marcarLidos(usuario, body?.codigos);
        });
    }
}
