import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Documento, { exigirLinkValido } from "../../domain/entity/Documento";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import EnviarDocumentoInput from "./EnviarDocumentoInput";
import { hoje } from "../../shared/datas";

export default class EnviarDocumento {
    private readonly pastas;
    private readonly usuarios;
    private readonly documentos;
    constructor(factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
        this.usuarios = factory.criarUsuarioRepository();
        this.documentos = factory.criarDocumentoRepository();
    }
    async execute(input: EnviarDocumentoInput): Promise<Documento> {
        const pasta = await this.pastas.buscarPorCodigo(input.codigoPasta);
        if (!pasta) throw new ErroNaoEncontrado("Pasta não encontrada.");
        const autor = await this.usuarios.buscarPorCodigo(input.codigoAutor);
        if (!autor || !autor.ativo) throw new ErroNaoEncontrado("Usuário ativo não encontrado.");
        return this.documentos.criar(
            new Documento(
                pasta,
                input.nome,
                input.tamanhoBytes,
                input.dataEnvio ?? hoje(),
                autor,
                exigirLinkValido(input.arquivoUrl),
                input.extensao ?? null,
            ),
        );
    }
}
