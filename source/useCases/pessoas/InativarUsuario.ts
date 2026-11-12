import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import StatusPessoa from "../../domain/enum/StatusPessoa";
import AlterarStatusPessoa from "./AlterarStatusPessoa";

/** Mantido por compatibilidade com DELETE /usuarios/:codigo: muda o status para Inativo. */
export default class InativarUsuario {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(codigo: string): Promise<void> {
        await new AlterarStatusPessoa(this.factory).execute({ codigo, status: StatusPessoa.INATIVO });
    }
}
