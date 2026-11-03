import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Pasta from "../../domain/Entity/Pasta";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { montarPasta } from "../CriarPasta/CriarPasta";

/** Renomeia a pasta e, se `sigilo` vier, troca também o sigilo (e o projeto). */
export default class RenomearPasta {
    private readonly pastas;
    constructor(private readonly factory: RepositoryFactoryInterface) {
        this.pastas = factory.criarPastaRepository();
    }
    async execute(codigo: string, nome: string, sigilo?: string, codigoProjeto?: string | null): Promise<Pasta> {
        const p = await this.pastas.buscarPorCodigo(codigo);
        if (!p)
            throw new ErroNaoEncontrado("Pasta não encontrada.");
        const editada = sigilo === undefined
            ? new Pasta(String(nome ?? "").trim(), p.codigo, p.sigilo, p.projeto)
            : await montarPasta(this.factory, nome, sigilo, codigoProjeto, p.codigo);
        return this.pastas.editar(editada);
    }
}
