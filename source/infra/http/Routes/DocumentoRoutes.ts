import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarDocumentos from "../../../useCases/ListarDocumentos/ListarDocumentos";
import EnviarDocumento from "../../../useCases/EnviarDocumento/EnviarDocumento";
import RenomearDocumento from "../../../useCases/RenomearDocumento/RenomearDocumento";
import ExcluirDocumento from "../../../useCases/ExcluirDocumento/ExcluirDocumento";
import { exigirAutenticado, exigirPermissao, Permissao } from "../../../shared/seguranca/permissoes";

/**
 * Documentos são links (Drive etc.), decisão de 03/11/2026 (sessão 9). O envio de arquivo
 * para o servidor (/upload e /uploads) saiu: os arquivos ficavam no container, sem sigilo.
 */
export default class DocumentoRoutes implements ModelRoutes {
    constructor(private readonly http: Http, private readonly factory: RepositoryFactoryInterface) {}

    init(): void {
        this.http.route("get", "/pastas/:codigoPasta/documentos", true, async (params: any, body: any) =>
            new ListarDocumentos(this.factory).execute(params.codigoPasta, exigirAutenticado(body?.user)));

        this.http.route("post", "/pastas/:codigoPasta/documentos", true, async (params: any, body: any) =>
            new EnviarDocumento(this.factory).execute({
                codigoPasta: params.codigoPasta,
                nome: String(body.nome ?? ""),
                tamanhoBytes: Number(body.tamanhoBytes ?? 0) || 0,
                dataEnvio: body.dataEnvio ? new Date(body.dataEnvio) : undefined,
                codigoAutor: exigirPermissao(body.user, Permissao.DOCUMENTOS_GERIR).codigo,
                arquivoUrl: body.arquivoUrl,
                extensao: body.extensao ?? null,
            }));

        this.http.route("put", "/documentos/:codigo", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.DOCUMENTOS_GERIR);
            return new RenomearDocumento(this.factory).execute(params.codigo, String(body.nome ?? ""), body.arquivoUrl ?? undefined);
        });

        this.http.route("delete", "/documentos/:codigo", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.DOCUMENTOS_GERIR);
            return new ExcluirDocumento(this.factory).execute(params.codigo);
        });
    }
}
