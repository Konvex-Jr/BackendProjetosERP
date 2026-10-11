import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarCheckins from "../../../useCases/ListarCheckins/ListarCheckins";
import RegistrarCheckin from "../../../useCases/RegistrarCheckin/RegistrarCheckin";
import EditarCheckin from "../../../useCases/EditarCheckin/EditarCheckin";

export default class CheckinRoutes implements ModelRoutes {
    constructor(private readonly http: Http, private readonly factory: RepositoryFactoryInterface) {}

    init(): void {
        this.http.route("get", "/checkins", true, async (_params: any, _body: any, query: any) =>
            new ListarCheckins(this.factory).execute(query?.codigoUsuario));

        this.http.route("post", "/checkins", true, async (_params: any, body: any) =>
            new RegistrarCheckin(this.factory).execute({
                codigoUsuario: body.codigoUsuario ?? body.user?.codigo,
                semana: new Date(body.semana),
                resumo: body.resumo,
                aprendizados: body.aprendizados,
                humor: body.humor === undefined ? undefined : Number(body.humor),
                sentimento: body.sentimento ?? null,
            }));

        this.http.route("put", "/checkins", true, async (_params: any, body: any) =>
            new EditarCheckin(this.factory).execute({
                codigoUsuario: body.codigoUsuario ?? body.user?.codigo,
                semana: new Date(body.semana),
                resumo: body.resumo,
                aprendizados: body.aprendizados,
                humor: Number(body.humor),
                sentimento: body.sentimento ?? null,
            }));
    }
}
