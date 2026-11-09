import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import ListarDocumentos from "../../../useCases/ListarDocumentos/ListarDocumentos";
import EnviarDocumento from "../../../useCases/EnviarDocumento/EnviarDocumento";
import RenomearDocumento from "../../../useCases/RenomearDocumento/RenomearDocumento";
import ExcluirDocumento from "../../../useCases/ExcluirDocumento/ExcluirDocumento";
import Documento from "../../../domain/Entity/Documento";
import { DonoAnexo } from "../../../domain/Enum/Anexo";
import GerirAnexos from "../../../useCases/GerirAnexos/GerirAnexos";
import { exigirAutenticado, exigirPermissao, Permissao } from "../../../shared/seguranca/permissoes";

/**
 * Documento de pasta é um link (Drive etc., sessão 9) ou um arquivo anexado (sessão 12c,
 * enviado por POST /pastas/:codigo/documentos/arquivo, em AnexoRoutes). Cada documento
 * devolve `anexo` (ou null), com o que o frontend baixa o arquivo em GET /anexos/:codigo.
 */
export default class DocumentoRoutes implements ModelRoutes {
    constructor(private readonly http: Http, private readonly factory: RepositoryFactoryInterface) {}

    private async comAnexo(documentos: Documento[]) {
        const anexos = await new GerirAnexos(this.factory).porDono(DonoAnexo.DOCUMENTO, documentos.map((d) => d.codigo));
        return documentos.map((d) => Object.assign(d, { anexo: anexos.get(d.codigo)?.[0] ?? null }));
    }

    init(): void {
        this.http.route("get", "/pastas/:codigoPasta/documentos", true, async (params: any, body: any) =>
            this.comAnexo(await new ListarDocumentos(this.factory).execute(params.codigoPasta, exigirAutenticado(body?.user))));

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
            return (await this.comAnexo([await new RenomearDocumento(this.factory).execute(params.codigo, String(body.nome ?? ""), body.arquivoUrl ?? undefined)]))[0];
        });

        this.http.route("delete", "/documentos/:codigo", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.DOCUMENTOS_GERIR);
            return new ExcluirDocumento(this.factory).execute(params.codigo);
        });
    }
}
