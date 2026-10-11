import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Documento from "../../domain/Entity/Documento";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import EnviarDocumentoInput from "./EnviarDocumentoInput";

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
        if (!pasta)
            throw new ErroNaoEncontrado("Pasta não encontrada.");
        const autor = await this.usuarios.buscarPorCodigo(input.codigoAutor);
        if (!autor || !autor.ativo)
            throw new ErroNaoEncontrado("Usuário ativo não encontrado.");
        return this.documentos.criar(new Documento(pasta, input.nome, input.tamanhoBytes, input.dataEnvio ?? new Date(), autor, input.arquivoUrl, input.extensao ?? null));
    }
}
