import Capacitacao from "../../../domain/Entity/Capacitacao";
import CapacitacaoRepositoryInterface from "../../../domain/Interfaces/CapacitacaoRepositoryInterface";

export default class CapacitacaoRepositoryMemory implements CapacitacaoRepositoryInterface {
    private capacitacoes: Capacitacao[];

    constructor() {
        this.capacitacoes = [];
    }

    async criar(capacitacao: Capacitacao): Promise<Capacitacao> {
        this.capacitacoes.push(capacitacao);
        return capacitacao;
    }

    async listar(): Promise<Capacitacao[]> {
        return [...this.capacitacoes];
    }

    async buscarPorCodigo(codigo: string): Promise<Capacitacao | null> {
        return this.capacitacoes.find((c) => c.codigo === codigo) ?? null;
    }

    async editar(capacitacao: Capacitacao): Promise<Capacitacao> {
        const indice = this.capacitacoes.findIndex((c) => c.codigo === capacitacao.codigo);

        if (indice === -1) {
            throw new Error("Capacitação não encontrada");
        }

        this.capacitacoes[indice] = capacitacao;
        return capacitacao;
    }
}
