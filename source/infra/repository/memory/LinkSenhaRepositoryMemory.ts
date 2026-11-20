import LinkSenhaRepositoryInterface, { RegistroLinkSenha, TipoLink } from "../../../domain/interfaces/LinkSenhaRepositoryInterface";

export default class LinkSenhaRepositoryMemory implements LinkSenhaRepositoryInterface {
    private registros: RegistroLinkSenha[] = [];

    async criar(registro: RegistroLinkSenha): Promise<void> {
        this.registros.push({ ...registro });
    }

    async buscarPorHash(tokenHash: string): Promise<RegistroLinkSenha | null> {
        const registro = this.registros.find((r) => r.tokenHash === tokenHash);
        return registro ? { ...registro } : null;
    }

    async invalidarDoUsuario(codigoUsuario: string, tipo?: TipoLink): Promise<void> {
        for (const r of this.registros) {
            if (r.codigoUsuario === codigoUsuario && !r.usadoEm && (!tipo || r.tipo === tipo)) r.usadoEm = new Date();
        }
    }

    async marcarUsado(codigo: string): Promise<boolean> {
        const registro = this.registros.find((r) => r.codigo === codigo);
        if (!registro || registro.usadoEm) return false;
        registro.usadoEm = new Date();
        return true;
    }
}
