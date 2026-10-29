import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarProjetos from "../../../useCases/ListarProjetos/ListarProjetos";
import CriarProjeto from "../../../useCases/CriarProjeto/CriarProjeto";
import EditarProjeto from "../../../useCases/EditarProjeto/EditarProjeto";
import ExcluirProjeto from "../../../useCases/ExcluirProjeto/ExcluirProjeto";
import AlternarStatusProjeto from "../../../useCases/AlternarStatusProjeto/AlternarStatusProjeto";
import { exigirGestor } from "../../../shared/seguranca/permissoes";

export default class ProjetoRoutes implements ModelRoutes {
    constructor(private readonly http: Http, private readonly factory: RepositoryFactoryInterface) {}

    init(): void {
        this.http.route("get", "/projetos", true, async (_params: any, _body: any, query: any) =>
            new ListarProjetos(this.factory).execute(query?.codigoUsuario));

        this.http.route("post", "/projetos", true, async (_params: any, body: any) =>
            exigirGestor(body.user) && new CriarProjeto(this.factory).execute({
                nome: body.nome,
                descricao: body.descricao,
                dataInicio: new Date(body.dataInicio),
                dataFim: new Date(body.dataFim),
                codigosMembros: body.codigosMembros ?? [],
            }));

        this.http.route("put", "/projetos/:codigo", true, async (params: any, body: any) =>
            exigirGestor(body.user) && new EditarProjeto(this.factory).execute({
                codigo: params.codigo,
                nome: body.nome,
                descricao: body.descricao,
                dataInicio: new Date(body.dataInicio),
                dataFim: new Date(body.dataFim),
                codigosMembros: body.codigosMembros ?? [],
            }));

        this.http.route("patch", "/projetos/:codigo/status", true, async (params: any, body: any) =>
            exigirGestor(body.user) && new AlternarStatusProjeto(this.factory).execute(params.codigo));

        this.http.route("delete", "/projetos/:codigo", true, async (params: any, body: any) =>
            exigirGestor(body.user) && new ExcluirProjeto(this.factory).execute(params.codigo));
    }
}
