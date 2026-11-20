import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { excluirDadosDoProjeto } from "./excluirDadosDoProjeto";
import { exigirNaoGeral } from "./sincronizarGeral";

export default class ExcluirProjeto {
    private readonly projetos;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
    }
    async execute(codigo: string): Promise<void> {
        const projeto = await this.projetos.buscarPorCodigo(codigo);
        if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
        exigirNaoGeral(projeto);
        await excluirDadosDoProjeto(this.factory, codigo);
    }
}
