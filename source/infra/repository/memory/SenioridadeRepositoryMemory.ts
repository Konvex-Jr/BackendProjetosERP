import SenioridadeUsuario from "../../../domain/Entity/SenioridadeUsuario";
import SenioridadeRepositoryInterface from "../../../domain/Interfaces/SenioridadeRepositoryInterface";

export default class SenioridadeRepositoryMemory implements SenioridadeRepositoryInterface {
    private senioridades: SenioridadeUsuario[];

    constructor(
        senioridades: SenioridadeUsuario[] = [
            new SenioridadeUsuario("junior", "Júnior", 45),
            new SenioridadeUsuario("pleno", "Pleno", 75),
            new SenioridadeUsuario("senior", "Sênior", 120),
        ],
    ) {
        this.senioridades = senioridades;
    }

    async listar(): Promise<SenioridadeUsuario[]> {
        return [...this.senioridades];
    }

    async buscarPorCodigo(codigo: string): Promise<SenioridadeUsuario | null> {
        return this.senioridades.find((s) => s.codigo === codigo) ?? null;
    }
}
