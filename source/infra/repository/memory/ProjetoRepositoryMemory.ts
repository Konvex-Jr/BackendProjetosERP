import Projeto from "../../../domain/Entity/Projeto";
import ProjetoRepositoryInterface from "../../../domain/Interfaces/ProjetoRepositoryInterface";

export default class ProjetoRepositoryMemory implements ProjetoRepositoryInterface {
    private projetos: Projeto[];

    constructor() {
        this.projetos = [];
    }

    async criar(projeto: Projeto): Promise<Projeto> {
        this.projetos.push(projeto);
        return projeto;
    }

    async listar(): Promise<Projeto[]> {
        return [...this.projetos];
    }

    async listarPorMembro(codigoUsuario: string): Promise<Projeto[]> {
        return this.projetos.filter((p) =>
            p.membros.some((m) => m.codigo === codigoUsuario),
        );
    }

    async buscarPorCodigo(codigo: string): Promise<Projeto | null> {
        return this.projetos.find((p) => p.codigo === codigo) ?? null;
    }

    async editar(projeto: Projeto): Promise<Projeto> {
        const indice = this.projetos.findIndex((p) => p.codigo === projeto.codigo);

        if (indice === -1) {
            throw new Error("Projeto não encontrado");
        }

        this.projetos[indice] = projeto;
        return projeto;
    }

    async excluir(codigo: string): Promise<void> {
        const indice = this.projetos.findIndex((p) => p.codigo === codigo);

        if (indice === -1) {
            throw new Error("Projeto não encontrado");
        }

        this.projetos.splice(indice, 1);
    }
}
