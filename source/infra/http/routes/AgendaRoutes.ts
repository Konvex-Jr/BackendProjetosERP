import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import GerirAgenda, { EntradaReuniao } from "../../../useCases/agenda/GerirAgenda";
import { ErroValidacao } from "../../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import { exigirAutenticado, exigirPermissao, Permissao } from "../../../shared/seguranca/permissoes";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import RespostaSemConteudo from "../RespostaSemConteudo";

/** Data AAAA-MM-DD como meia-noite UTC; ausente = undefined. */
function lerDia(valor: unknown, mensagem: string, codigo: string): Date | undefined {
    if (valor === undefined) return undefined;
    const texto = String(valor ?? "");
    const data = new Date(`${texto}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
        throw new ErroValidacao(mensagem, codigo);
    }
    return data;
}

const inteiro = (v: unknown) => (v === undefined ? undefined : v === null || v === "" ? NaN : Number(v));

function lerReuniao(body: any): EntradaReuniao {
    return {
        titulo: body.titulo,
        descricao: body.descricao ?? undefined,
        data: lerDia(body.data, MENSAGENS_DE_ERRO.REUNIAO.DATA_INVALIDA, "DATA_REUNIAO_INVALIDA"),
        hora: body.hora,
        duracaoMinutos: inteiro(body.duracaoMinutos),
        local: body.local ?? undefined,
        participantes: body.participantes,
    };
}

/** Agenda unificada e reuniões (sessão 28b): de todo logado; sem permissão no catálogo. */
export default class AgendaRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    init(): void {
        const gerir = () => new GerirAgenda(this.factory);
        const P = MENSAGENS_DE_ERRO.AGENDA.PERIODO_INVALIDO;

        this.http.route("get", "/agenda", true, async (_p: any, body: any, query: any) => {
            const usuario = exigirAutenticado(body?.user);
            const de = lerDia(query?.de, P, "AGENDA_PERIODO_INVALIDO");
            const ate = lerDia(query?.ate, P, "AGENDA_PERIODO_INVALIDO");
            if (!de || !ate) throw new ErroValidacao(P, "AGENDA_PERIODO_INVALIDO");
            return gerir().agenda(usuario, de, ate, query?.pessoa ? String(query.pessoa) : undefined);
        });

        this.http.route("get", "/reunioes/:codigo", true, async (params: any, body: any) =>
            gerir().ficha(exigirAutenticado(body?.user), params.codigo),
        );

        this.http.route("post", "/reunioes", true, async (_p: any, body: any) =>
            gerir().criar(
                exigirPermissao(body?.user, Permissao.REUNIOES_CRIAR, "Você não tem permissão para criar reuniões."),
                lerReuniao(body ?? {}),
            ),
        );

        this.http.route("put", "/reunioes/:codigo", true, async (params: any, body: any) =>
            gerir().editar(exigirAutenticado(body?.user), params.codigo, lerReuniao(body ?? {})),
        );

        this.http.route("delete", "/reunioes/:codigo", true, async (params: any, body: any) => {
            await gerir().excluir(exigirAutenticado(body?.user), params.codigo);
            return new RespostaSemConteudo();
        });
    }
}
