import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarCapacitacoes from "../../../useCases/ListarCapacitacoes/ListarCapacitacoes";
import InscreverCapacitacao from "../../../useCases/InscreverCapacitacao/InscreverCapacitacao";
import CancelarInscricaoCapacitacao from "../../../useCases/CancelarInscricaoCapacitacao/CancelarInscricaoCapacitacao";
import EnviarFeedbackCapacitacao from "../../../useCases/EnviarFeedbackCapacitacao/EnviarFeedbackCapacitacao";
import ListarFeedbacks from "../../../useCases/ListarFeedbacks/ListarFeedbacks";
import CriarCapacitacao from "../../../useCases/CriarCapacitacao/CriarCapacitacao";
import PerfilUsuario from "../../../domain/Enum/PerfilUsuario";
import { ErroNaoAutorizado } from "../../../shared/erros/ErroNaoAutorizado";

export default class CapacitacaoRoutes implements ModelRoutes {
    constructor(private readonly http: Http, private readonly factory: RepositoryFactoryInterface) {}

    init(): void {
        this.http.route("get", "/capacitacoes", true, async () =>
            new ListarCapacitacoes(this.factory).execute());

        this.http.route("post", "/capacitacoes", true, async (_params: any, body: any) => {
            if (body.user?.perfil !== PerfilUsuario.DIRETOR) {
                throw new ErroNaoAutorizado("Somente diretores podem criar capacitações.");
            }
            return new CriarCapacitacao(this.factory).execute({
                titulo: body.titulo,
                data: new Date(body.data),
                hora: body.hora,
                codigoInstrutor: body.codigoInstrutor ?? body.instrutor?.codigo,
                vagas: Number(body.vagas),
                tipo: body.tipo,
                sala: body.sala,
            });
        });

        this.http.route("post", "/capacitacoes/:codigo/inscricoes", true, async (params: any, body: any) =>
            new InscreverCapacitacao(this.factory).execute(params.codigo, body.codigoUsuario ?? body.user?.codigo));

        this.http.route("delete", "/capacitacoes/:codigo/inscricoes/:codigoUsuario", true, async (params: any) =>
            new CancelarInscricaoCapacitacao(this.factory).execute(params.codigo, params.codigoUsuario));

        this.http.route("post", "/capacitacoes/:codigo/feedbacks", true, async (params: any, body: any) =>
            new EnviarFeedbackCapacitacao(this.factory).execute({
                codigoCapacitacao: params.codigo,
                codigoUsuario: body.codigoUsuario ?? body.user?.codigo,
                nota: Number(body.nota),
                bom: body.bom ?? null,
                melhorar: body.melhorar ?? null,
                data: body.data ? new Date(body.data) : undefined,
            }));

        this.http.route("get", "/feedbacks", true, async (_params: any, _body: any, query: any) =>
            new ListarFeedbacks(this.factory).execute(query?.codigoUsuario));
    }
}
