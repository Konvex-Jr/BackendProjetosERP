import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import { TIPOS_CAPACITACAO } from "../../../domain/Enum/TipoCapacitacao";
import GerirCapacitacoes, { EntradaCapacitacao } from "../../../useCases/GerirCapacitacoes/GerirCapacitacoes";
import { ErroValidacao } from "../../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import { exigirAutenticado } from "../../../shared/seguranca/permissoes";
import { podeGerirCapacitacoes } from "../../../shared/seguranca/regrasCapacitacao";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";

const M = MENSAGENS_DE_ERRO.CAPACITACAO;

/** Data AAAA-MM-DD como meia-noite UTC (mesmo formato do banco); ausente = não alterar. */
function lerData(valor: unknown): Date | undefined {
    if (valor === undefined) return undefined;
    const texto = String(valor ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(new Date(`${texto}T00:00:00Z`).getTime())) {
        throw new ErroValidacao(M.DATA_INVALIDA, "DATA_CAPACITACAO_INVALIDA");
    }
    return new Date(`${texto}T00:00:00Z`);
}

const numero = (v: unknown) => (v === undefined ? undefined : v === null || v === "" ? NaN : Number(String(v).replace(",", ".")));

function lerEntrada(body: any): EntradaCapacitacao {
    return {
        titulo: body.titulo,
        descricao: body.descricao ?? undefined,
        data: lerData(body.data),
        hora: body.hora,
        duracaoHoras: numero(body.duracaoHoras),
        codigoInstrutor: body.codigoInstrutor ?? body.instrutor?.codigo,
        vagas: numero(body.vagas),
        tipo: body.tipo,
        sala: body.sala,
    };
}

/** Capacitações (RF-070 a RF-073, sessão 13). Regras em shared/seguranca/regrasCapacitacao.ts. */
export default class CapacitacaoRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    init(): void {
        const gerir = () => new GerirCapacitacoes(this.factory);

        this.http.route("get", "/capacitacoes/opcoes", true, async (_p: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            return { tipos: TIPOS_CAPACITACAO, podeGerir: podeGerirCapacitacoes(usuario) };
        });

        this.http.route("get", "/capacitacoes", true, async (_p: any, body: any) => gerir().listar(body?.user));

        this.http.route("get", "/capacitacoes/:codigo", true, async (params: any, body: any) => gerir().ficha(body?.user, params.codigo));

        this.http.route("post", "/capacitacoes", true, async (_p: any, body: any) => gerir().salvar(body?.user, lerEntrada(body)));

        this.http.route("put", "/capacitacoes/:codigo", true, async (params: any, body: any) =>
            gerir().salvar(body?.user, lerEntrada(body), params.codigo),
        );

        this.http.route("delete", "/capacitacoes/:codigo", true, async (params: any, body: any) =>
            gerir().excluir(body?.user, params.codigo),
        );

        // Sem `codigoUsuario`, inscreve quem está logado; com outro código, só a gestão.
        this.http.route("post", "/capacitacoes/:codigo/inscricoes", true, async (params: any, body: any) =>
            gerir().inscrever(body?.user, params.codigo, body?.codigoUsuario || undefined),
        );

        this.http.route("delete", "/capacitacoes/:codigo/inscricoes/:codigoUsuario", true, async (params: any, body: any) =>
            gerir().cancelar(body?.user, params.codigo, params.codigoUsuario),
        );

        this.http.route("put", "/capacitacoes/:codigo/presencas", true, async (params: any, body: any) =>
            gerir().marcarPresencas(body?.user, params.codigo, body?.presentes),
        );

        this.http.route("put", "/capacitacoes/:codigo/avaliacao", true, async (params: any, body: any) =>
            gerir().avaliar(body?.user, params.codigo, { nota: Number(body?.nota), bom: body?.bom, melhorar: body?.melhorar }),
        );

        this.http.route("get", "/capacitacoes/:codigo/avaliacoes", true, async (params: any, body: any) =>
            gerir().avaliacoes(body?.user, params.codigo),
        );
    }
}
