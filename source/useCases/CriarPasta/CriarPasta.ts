import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Pasta from "../../domain/Entity/Pasta";
import SigiloPasta from "../../domain/Enum/SigiloPasta";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

/** Monta a pasta conferindo o projeto quando o sigilo é "projeto". */
export async function montarPasta(
    factory: RepositoryFactoryInterface,
    nome: string,
    sigilo: string = SigiloPasta.TODOS,
    codigoProjeto?: string | null,
    codigo?: string,
): Promise<Pasta> {
    let projeto = null;
    if (sigilo === SigiloPasta.PROJETO && codigoProjeto) {
        const encontrado = await factory.criarProjetoRepository().buscarPorCodigo(codigoProjeto);
        if (!encontrado) throw new ErroNaoEncontrado("Projeto não encontrado.");
        projeto = { codigo: encontrado.codigo, nome: encontrado.nome };
    }
    return new Pasta(String(nome ?? "").trim(), codigo, sigilo, projeto);
}

export default class CriarPasta {
    private readonly pastas;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
    }
    async execute(nome: string, sigilo?: string, codigoProjeto?: string | null): Promise<Pasta> {
        return this.pastas.criar(await montarPasta(this.factory, nome, sigilo, codigoProjeto));
    }
}
