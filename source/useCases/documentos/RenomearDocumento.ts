import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Documento, { exigirLinkValido } from "../../domain/entity/Documento";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export default class RenomearDocumento {
    private readonly documentos;
    constructor(factory: RepositoryFactoryInterface) {
        this.documentos = factory.criarDocumentoRepository();
    }
    /** Renomeia; se `arquivoUrl` vier, troca também o link. */
    async execute(codigo: string, nome: string, arquivoUrl?: string): Promise<Documento> {
        const d = await this.documentos.buscarPorCodigo(codigo);
        if (!d) throw new ErroNaoEncontrado("Documento não encontrado.");
        if (arquivoUrl !== undefined && d.arquivoUrl === null)
            throw new ErroValidacao(MENSAGENS_DE_ERRO.ANEXO.DOCUMENTO_E_ARQUIVO, "DOCUMENTO_E_ARQUIVO");
        return this.documentos.editar(
            new Documento(
                d.pasta,
                nome.trim(),
                d.tamanhoBytes,
                d.dataEnvio,
                d.autor,
                arquivoUrl === undefined ? d.arquivoUrl : exigirLinkValido(arquivoUrl),
                d.extensao,
                d.codigo,
            ),
        );
    }
}
