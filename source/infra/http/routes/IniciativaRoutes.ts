import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import Iniciativa from "../../../domain/entity/Iniciativa";
import StatusTarefa from "../../../domain/enum/StatusTarefa";
import { FRENTES_INICIATIVA, STATUS_INICIATIVA, TIPOS_INICIATIVA } from "../../../domain/enum/Iniciativa";
import SalvarIniciativa, { tarefasDaIniciativa } from "../../../useCases/iniciativas/SalvarIniciativa";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import { exigirAutenticado, UsuarioAutenticado } from "../../../shared/seguranca/permissoes";
import { podeAlterarIniciativa } from "../../../shared/seguranca/regrasIniciativa";
import GerirAnexos from "../../../useCases/anexos/GerirAnexos";
import { DonoAnexo } from "../../../domain/enum/Anexo";
import { regrasTarefa } from "../../../shared/seguranca/regrasTarefa";

const texto = (valor: unknown) => String(valor ?? "").trim() || undefined;

/** Iniciativas de inovação (sessão 12b, RF-090 a RF-092). Leitura para todos. */
export default class IniciativaRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    /** Cada iniciativa diz se quem pediu pode editar/excluir, para o frontend não repetir a regra. */
    /** Também traz os arquivos anexados (sessão 12c). */
    private async comAcoes(usuario: UsuarioAutenticado, itens: Iniciativa[]) {
        const anexos = await new GerirAnexos(this.factory).porDono(
            DonoAnexo.INICIATIVA,
            itens.map((i) => i.codigo),
        );
        return itens.map((item) => ({ ...item, podeAlterar: podeAlterarIniciativa(usuario, item), anexos: anexos.get(item.codigo) ?? [] }));
    }

    /** Ficha: tarefas ligadas que a pessoa pode ver (as avulsas seguem a regra da 8c) e a contagem de todas. */
    private async ficha(usuario: UsuarioAutenticado, item: Iniciativa) {
        const todas = await tarefasDaIniciativa(this.factory, item.codigo);
        const visiveis = todas.filter((t) => regrasTarefa(usuario, t, null).ver);
        return {
            ...(await this.comAcoes(usuario, [item]))[0],
            tarefas: visiveis.map((t) => ({
                codigo: t.codigo,
                titulo: t.titulo,
                status: t.status,
                prioridade: t.prioridade,
                dataFim: t.dataFim,
                responsaveis: t.responsaveis.map((r) => ({ codigo: r.codigo, nome: r.nome })),
            })),
            totalTarefas: todas.length,
            tarefasConcluidas: todas.filter((t) => t.status === StatusTarefa.CONCLUIDA).length,
        };
    }

    init(): void {
        const f = this.factory;

        this.http.route("get", "/iniciativas/opcoes", true, async (_p: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            return {
                status: STATUS_INICIATIVA,
                tipos: TIPOS_INICIATIVA,
                frentes: FRENTES_INICIATIVA,
                podeCriar: await new SalvarIniciativa(f).podeCriar(usuario),
            };
        });

        this.http.route("get", "/iniciativas", true, async (_p: any, body: any, query: any) => {
            const usuario = exigirAutenticado(body?.user);
            const itens = await f.criarIniciativaRepository().listar({
                busca: texto(query?.busca),
                status: texto(query?.status),
                tipo: texto(query?.tipo),
                frente: texto(query?.frente),
                codigoResponsavel: texto(query?.codigoResponsavel),
                codigoProjeto: texto(query?.codigoProjeto),
                codigoConhecimento: texto(query?.codigoConhecimento),
            });
            return this.comAcoes(usuario, itens);
        });

        this.http.route("get", "/iniciativas/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            const item = await f.criarIniciativaRepository().buscarPorCodigo(params.codigo);
            if (!item) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.INICIATIVA.NAO_ENCONTRADA);
            return this.ficha(usuario, item);
        });

        this.http.route("post", "/iniciativas", true, async (_p: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            return this.ficha(usuario, await new SalvarIniciativa(f).criar(usuario, body ?? {}));
        });

        this.http.route("put", "/iniciativas/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            return this.ficha(usuario, await new SalvarIniciativa(f).editar(usuario, params.codigo, body ?? {}));
        });

        this.http.route("delete", "/iniciativas/:codigo", true, async (params: any, body: any) =>
            new SalvarIniciativa(f).excluir(body?.user, params.codigo),
        );
    }
}
