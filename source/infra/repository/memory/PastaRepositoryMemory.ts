import Pasta from "../../../domain/entity/Pasta";
import PastaRepositoryInterface from "../../../domain/interfaces/PastaRepositoryInterface";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

export default class PastaRepositoryMemory implements PastaRepositoryInterface {
    private pastas: Pasta[];

    constructor() {
        this.pastas = [];
    }

    async criar(pasta: Pasta): Promise<Pasta> {
        this.pastas.push(pasta);
        return pasta;
    }

    async listar(): Promise<Pasta[]> {
        return [...this.pastas];
    }

    async buscarPorCodigo(codigo: string): Promise<Pasta | null> {
        return this.pastas.find((p) => p.codigo === codigo) ?? null;
    }

    async editar(pasta: Pasta): Promise<Pasta> {
        const indice = this.pastas.findIndex((p) => p.codigo === pasta.codigo);

        if (indice === -1) {
            throw new ErroNaoEncontrado("Pasta não encontrada.");
        }

        this.pastas[indice] = pasta;
        return pasta;
    }

    async excluir(codigo: string): Promise<void> {
        const indice = this.pastas.findIndex((p) => p.codigo === codigo);

        if (indice === -1) {
            throw new ErroNaoEncontrado("Pasta não encontrada.");
        }

        this.pastas.splice(indice, 1);
    }
}
