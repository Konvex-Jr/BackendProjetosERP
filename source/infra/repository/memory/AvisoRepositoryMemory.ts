import { randomUUID } from "crypto";
import AvisoRepositoryInterface, { NovoAviso, RegistroAviso } from "../../../domain/interfaces/AvisoRepositoryInterface";

export default class AvisoRepositoryMemory implements AvisoRepositoryInterface {
    private registros: RegistroAviso[] = [];

    async criarVarios(avisos: NovoAviso[]): Promise<void> {
        for (const a of avisos) {
            const repetido =
                a.tipo === "tarefa_recebida" &&
                this.registros.some(
                    (r) =>
                        r.tipo === "tarefa_recebida" &&
                        r.codigoUsuario === a.codigoUsuario &&
                        r.codigoTarefa === a.codigoTarefa &&
                        !r.lidoEm,
                );
            if (repetido) continue;
            this.registros.push({ ...a, codigo: randomUUID(), criadoEm: new Date(), lidoEm: null });
        }
    }

    async listarDoUsuario(codigoUsuario: string): Promise<RegistroAviso[]> {
        return (
            this.registros
                .map((r, i) => ({ r, i }))
                .filter(({ r }) => r.codigoUsuario === codigoUsuario)
                // Mesmo milissegundo: o gravado depois vem primeiro.
                .sort((a, b) => b.r.criadoEm.getTime() - a.r.criadoEm.getTime() || b.i - a.i)
                .map(({ r }) => ({ ...r }))
        );
    }

    async marcarLidos(codigoUsuario: string, codigos?: string[]): Promise<void> {
        for (const r of this.registros) {
            if (r.codigoUsuario !== codigoUsuario || r.lidoEm) continue;
            if (!codigos || codigos.includes(r.codigo)) r.lidoEm = new Date();
        }
    }

    async apagarLidosAntes(codigoUsuario: string, limite: Date): Promise<void> {
        this.registros = this.registros.filter((r) => !(r.codigoUsuario === codigoUsuario && r.lidoEm && r.lidoEm < limite));
    }
}
