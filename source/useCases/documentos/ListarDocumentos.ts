import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Documento from "../../domain/entity/Documento";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { exigirVerPasta } from "../../shared/seguranca/sigiloPastas";

export default class ListarDocumentos {
    private readonly pastas;
    private readonly documentos;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
        this.documentos = factory.criarDocumentoRepository();
    }
    /** Com `usuario`, pasta que ele não pode ler responde 404 (como se não existisse). */
    async execute(codigoPasta: string, usuario?: UsuarioAutenticado): Promise<Documento[]> {
        const pasta = await this.pastas.buscarPorCodigo(codigoPasta);
        if (usuario) await exigirVerPasta(usuario, pasta, this.factory);
        else if (!pasta) throw new ErroNaoEncontrado("Pasta não encontrada.");
        return this.documentos.listarPorPasta(codigoPasta);
    }
}
