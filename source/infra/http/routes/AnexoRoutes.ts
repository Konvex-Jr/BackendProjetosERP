import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import { DonoAnexo, EXTENSOES_ANEXO, LIMITE_ANEXO_BYTES } from "../../../domain/enum/Anexo";
import GerirAnexos from "../../../useCases/anexos/GerirAnexos";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import { exigirAutenticado } from "../../../shared/seguranca/permissoes";
import Http, { OpcoesRota } from "../Http";
import RespostaArquivo from "../RespostaArquivo";
import ModelRoutes from "./ModelRoutes";

// Margem para o corpo cru: o limite de verdade (20 MB) é conferido no Anexo, com mensagem clara.
const RECEBE_ARQUIVO: OpcoesRota = {
    arquivo: { limiteBytes: LIMITE_ANEXO_BYTES + 1024, mensagemLimite: MENSAGENS_DE_ERRO.ANEXO.GRANDE_DEMAIS },
};

/**
 * Anexos (sessão 12c): o arquivo vai no corpo da requisição (bytes) e o nome no cabeçalho
 * X-Nome-Arquivo. Download pela API, com as regras de leitura do dono.
 */
export default class AnexoRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    init(): void {
        const gerir = () => new GerirAnexos(this.factory);

        this.http.route("get", "/anexos/regras", true, async (_p: any, body: any) => {
            exigirAutenticado(body?.user);
            return { limiteBytes: LIMITE_ANEXO_BYTES, extensoes: EXTENSOES_ANEXO };
        });

        this.http.route(
            "post",
            "/biblioteca/:codigo/anexos",
            true,
            async (params: any, body: any) => gerir().enviar(body?.user, DonoAnexo.BIBLIOTECA, params.codigo, body.arquivo),
            RECEBE_ARQUIVO,
        );

        this.http.route(
            "post",
            "/capacitacoes/:codigo/anexos",
            true,
            async (params: any, body: any) => gerir().enviar(body?.user, DonoAnexo.CAPACITACAO, params.codigo, body.arquivo),
            RECEBE_ARQUIVO,
        );

        this.http.route(
            "post",
            "/tarefas/:codigo/anexos",
            true,
            async (params: any, body: any) => gerir().enviar(body?.user, DonoAnexo.TAREFA, params.codigo, body.arquivo),
            RECEBE_ARQUIVO,
        );

        this.http.route("get", "/tarefas/:codigo/anexos", true, async (params: any, body: any) =>
            gerir().listar(body?.user, DonoAnexo.TAREFA, params.codigo),
        );

        this.http.route("get", "/anexos/:codigo", true, async (params: any, body: any) => {
            const { anexo, fluxo, tamanho } = await gerir().baixar(body?.user, params.codigo);
            return new RespostaArquivo(anexo.nome, anexo.tipoMime, fluxo, tamanho);
        });

        this.http.route("delete", "/anexos/:codigo", true, async (params: any, body: any) => gerir().excluir(body?.user, params.codigo));
    }
}
