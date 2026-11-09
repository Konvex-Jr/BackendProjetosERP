import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import SalvarConhecimento from "../../../useCases/SalvarConhecimento/SalvarConhecimento";
import { CATEGORIAS_CONHECIMENTO } from "../../../domain/Enum/CategoriaConhecimento";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import { lerData } from "../../../shared/entradas";
import { exigirAutenticado } from "../../../shared/seguranca/permissoes";
import GerirAnexos from "../../../useCases/GerirAnexos/GerirAnexos";
import { DonoAnexo } from "../../../domain/Enum/Anexo";
import { podeAlterarConhecimento } from "../../../shared/seguranca/regrasConhecimento";
import Conhecimento from "../../../domain/Entity/Conhecimento";
import { ErroValidacao } from "../../../shared/erros/ErroValidacao";

/** Base de Inteligência (sessão 12a, RF-080 a RF-084). Leitura e cadastro para todos. */
export default class ConhecimentoRoutes implements ModelRoutes {
    constructor(private readonly http: Http, private readonly factory: RepositoryFactoryInterface) {}

    init(): void {
        const f = this.factory;
        // Cada item diz se quem pediu pode editar/excluir, para o frontend não repetir a regra.
        // Também traz as iniciativas que citam o item (a ligação é feita na iniciativa, sessão 12b).
        const iniciativasPorItem = async () => {
            const mapa = new Map<string, { codigo: string; nome: string }[]>();
            for (const i of await f.criarIniciativaRepository().listar()) {
                for (const c of i.conhecimentos) {
                    mapa.set(c.codigo, [...(mapa.get(c.codigo) ?? []), { codigo: i.codigo, nome: i.titulo }]);
                }
            }
            return mapa;
        };
        // E os arquivos anexados (sessão 12c).
        const responder = async (usuario: any, itens: Conhecimento[]) => {
            const mapa = await iniciativasPorItem();
            const anexos = await new GerirAnexos(f).porDono(DonoAnexo.CONHECIMENTO, itens.map((i) => i.codigo));
            return itens.map((item) => ({
                ...item,
                podeAlterar: podeAlterarConhecimento(usuario, item),
                iniciativas: (mapa.get(item.codigo) ?? []).sort((a, b) => a.nome.localeCompare(b.nome)),
                anexos: anexos.get(item.codigo) ?? [],
            }));
        };
        const responderUm = async (usuario: any, item: Conhecimento) => (await responder(usuario, [item]))[0];

        this.http.route("get", "/conhecimento/categorias", true, async (_p: any, body: any) => {
            exigirAutenticado(body?.user);
            return CATEGORIAS_CONHECIMENTO;
        });

        this.http.route("get", "/conhecimento", true, async (_p: any, body: any, query: any) => {
            const usuario = exigirAutenticado(body?.user);
            const de = lerData(query?.de, "de") ?? undefined;
            const ate = lerData(query?.ate, "ate") ?? undefined;
            if (de && ate && de > ate) {
                throw new ErroValidacao("A data inicial do período deve ser anterior à final.", "PERIODO_INVALIDO");
            }
            const itens = await f.criarConhecimentoRepository().listar({
                busca: String(query?.busca ?? "").trim() || undefined,
                categoria: query?.categoria || undefined,
                tag: String(query?.tag ?? "").trim().replace(/^#+/, "") || undefined,
                codigoAutor: query?.codigoAutor || undefined,
                codigoProjeto: query?.codigoProjeto || undefined,
                de,
                ate,
            });
            return responder(usuario, itens);
        });

        this.http.route("get", "/conhecimento/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            const item = await f.criarConhecimentoRepository().buscarPorCodigo(params.codigo);
            if (!item) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CONHECIMENTO.NAO_ENCONTRADO);
            return responderUm(usuario, item);
        });

        this.http.route("post", "/conhecimento", true, async (_p: any, body: any) =>
            responderUm(body?.user, await new SalvarConhecimento(f).criar(body?.user, body ?? {})));

        this.http.route("put", "/conhecimento/:codigo", true, async (params: any, body: any) =>
            responderUm(body?.user, await new SalvarConhecimento(f).editar(body?.user, params.codigo, body ?? {})));

        this.http.route("delete", "/conhecimento/:codigo", true, async (params: any, body: any) =>
            new SalvarConhecimento(f).excluir(body?.user, params.codigo));
    }
}
