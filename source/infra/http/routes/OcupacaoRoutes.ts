import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ConsultarOcupacao from "../../../useCases/tarefas/ConsultarOcupacao";
import { exigirAutenticado } from "../../../shared/seguranca/permissoes";
import { ErroValidacao } from "../../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";

/** `semana` da query: AAAA-MM-DD de um dia que existe (qualquer dia da semana). Ausente = semana de hoje. */
function lerSemana(valor: unknown): Date | undefined {
    if (valor === undefined || valor === "") return undefined;
    const texto = String(valor);
    const data = new Date(`${texto}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.OCUPACAO.SEMANA_INVALIDA, "SEMANA_INVALIDA");
    }
    return data;
}

/** Ocupação semanal (sessão 24a): o total é de todo logado; o detalhe respeita o sigilo (ConsultarOcupacao). */
export default class OcupacaoRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    init(): void {
        this.http.route("get", "/ocupacao", true, async (_params: any, body: any, query: any) => {
            exigirAutenticado(body?.user);
            return new ConsultarOcupacao(this.factory).todas(lerSemana(query?.semana));
        });

        this.http.route("get", "/ocupacao/:codigoUsuario", true, async (params: any, body: any, query: any) => {
            const usuario = exigirAutenticado(body?.user);
            return new ConsultarOcupacao(this.factory).dePessoa(usuario, params.codigoUsuario, lerSemana(query?.semana));
        });
    }
}
