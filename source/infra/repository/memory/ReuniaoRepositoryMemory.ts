import Reuniao from "../../../domain/entity/Reuniao";
import ReuniaoRepositoryInterface from "../../../domain/interfaces/ReuniaoRepositoryInterface";

export default class ReuniaoRepositoryMemory implements ReuniaoRepositoryInterface {
    private reunioes: Reuniao[] = [];

    async listarDaPessoa(codigoUsuario: string, de: Date, ate: Date): Promise<Reuniao[]> {
        return this.reunioes
            .filter((r) => r.participa(codigoUsuario) && r.data >= de && r.data <= ate)
            .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    }

    async buscarPorCodigo(codigo: string): Promise<Reuniao | null> {
        return this.reunioes.find((r) => r.codigo === codigo) ?? null;
    }

    async criar(reuniao: Reuniao): Promise<Reuniao> {
        this.reunioes.push(reuniao);
        return reuniao;
    }

    async editar(reuniao: Reuniao): Promise<Reuniao> {
        this.reunioes = this.reunioes.map((r) => (r.codigo === reuniao.codigo ? reuniao : r));
        return reuniao;
    }

    async excluir(codigo: string): Promise<void> {
        this.reunioes = this.reunioes.filter((r) => r.codigo !== codigo);
    }
}
