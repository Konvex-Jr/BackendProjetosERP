import Anexo from "../../../domain/entity/Anexo";
import { DonoAnexo } from "../../../domain/enum/Anexo";
import AnexoRepositoryInterface from "../../../domain/interfaces/AnexoRepositoryInterface";

export default class AnexoRepositoryMemory implements AnexoRepositoryInterface {
    private itens: Anexo[] = [];

    async criar(anexo: Anexo): Promise<Anexo> {
        this.itens.push(anexo);
        return anexo;
    }

    async buscarPorCodigo(codigo: string): Promise<Anexo | null> {
        return this.itens.find((a) => a.codigo === codigo) ?? null;
    }

    async listarPorDonos(tipo: DonoAnexo, codigosDonos: string[]): Promise<Anexo[]> {
        const donos = new Set(codigosDonos);
        return this.itens
            .filter((a) => a.donoTipo === tipo && donos.has(a.donoCodigo))
            .sort((a, b) => a.enviadoEm.getTime() - b.enviadoEm.getTime());
    }

    async contarPorDonos(tipo: DonoAnexo, codigosDonos: string[]): Promise<Map<string, number>> {
        const donos = new Set(codigosDonos);
        const mapa = new Map<string, number>();
        for (const a of this.itens) {
            if (a.donoTipo === tipo && donos.has(a.donoCodigo)) mapa.set(a.donoCodigo, (mapa.get(a.donoCodigo) ?? 0) + 1);
        }
        return mapa;
    }

    async excluir(codigo: string): Promise<void> {
        this.itens = this.itens.filter((a) => a.codigo !== codigo);
    }
}
