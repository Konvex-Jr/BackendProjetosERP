import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import { DonoAnexo, EXTENSOES_ANEXO, LIMITE_ANEXO_BYTES } from "../../../domain/Enum/Anexo";
import GerirAnexos from "../../../useCases/GerirAnexos/GerirAnexos";
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
    constructor(private readonly http: Http, private readonly factory: RepositoryFactoryInterface) {}

    init(): void {
        const gerir = () => new GerirAnexos(this.factory);

        this.http.route("get", "/anexos/regras", true, async (_p: any, body: any) => {
            exigirAutenticado(body?.user);
            return { limiteBytes: LIMITE_ANEXO_BYTES, extensoes: EXTENSOES_ANEXO };
        });

        this.http.route("post", "/conhecimento/:codigo/anexos", true, async (params: any, body: any) =>
            gerir().enviar(body?.user, DonoAnexo.CONHECIMENTO, params.codigo, body.arquivo), RECEBE_ARQUIVO);

        this.http.route("post", "/iniciativas/:codigo/anexos", true, async (params: any, body: any) =>
            gerir().enviar(body?.user, DonoAnexo.INICIATIVA, params.codigo, body.arquivo), RECEBE_ARQUIVO);

        // Documento do tipo arquivo numa pasta; `?nome=` opcional (padrão: nome do arquivo sem extensão).
        this.http.route("post", "/pastas/:codigoPasta/documentos/arquivo", true, async (params: any, body: any, query: any) =>
            gerir().enviarDocumento(body?.user, params.codigoPasta, body.arquivo, query?.nome ? String(query.nome) : undefined), RECEBE_ARQUIVO);

        this.http.route("get", "/anexos/:codigo", true, async (params: any, body: any) => {
            const { anexo, conteudo } = await gerir().baixar(body?.user, params.codigo);
            return new RespostaArquivo(anexo.nome, anexo.tipoMime, conteudo);
        });

        this.http.route("delete", "/anexos/:codigo", true, async (params: any, body: any) =>
            gerir().excluir(body?.user, params.codigo));
    }
}
