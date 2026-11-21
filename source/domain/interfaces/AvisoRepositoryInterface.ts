export type TipoAviso = "tarefa_recebida" | "capacitacao_nova";

export interface NovoAviso {
    codigoUsuario: string;
    tipo: TipoAviso;
    codigoTarefa: string | null;
    codigoCapacitacao: string | null;
    codigoAutor: string | null;
}

export interface RegistroAviso extends NovoAviso {
    codigo: string;
    criadoEm: Date;
    lidoEm: Date | null;
}

export default interface AvisoRepositoryInterface {
    /** Ignora `tarefa_recebida` repetido enquanto o anterior (mesma pessoa e tarefa) não foi lido. */
    criarVarios(avisos: NovoAviso[]): Promise<void>;
    /** Todos da pessoa, mais recentes primeiro. */
    listarDoUsuario(codigoUsuario: string): Promise<RegistroAviso[]>;
    /** Sem `codigos`: todos os não lidos da pessoa. Códigos de outra pessoa são ignorados. */
    marcarLidos(codigoUsuario: string, codigos?: string[]): Promise<void>;
    apagarLidosAntes(codigoUsuario: string, limite: Date): Promise<void>;
}
