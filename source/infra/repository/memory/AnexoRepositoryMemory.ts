import Anexo from "../../../domain/Entity/Anexo";
import { DonoAnexo } from "../../../domain/Enum/Anexo";
import AnexoRepositoryInterface from "../../../domain/Interfaces/AnexoRepositoryInterface";

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

    async excluir(codigo: string): Promise<void> {
        this.itens = this.itens.filter((a) => a.codigo !== codigo);
    }
}
