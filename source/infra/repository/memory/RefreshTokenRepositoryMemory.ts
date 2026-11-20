import RefreshTokenRepositoryInterface, { RegistroRefreshToken } from "../../../domain/interfaces/RefreshTokenRepositoryInterface";

export default class RefreshTokenRepositoryMemory implements RefreshTokenRepositoryInterface {
    private registros: RegistroRefreshToken[] = [];

    async criar(registro: RegistroRefreshToken): Promise<void> {
        this.registros.push({ ...registro });
    }

    async buscarPorHash(tokenHash: string): Promise<RegistroRefreshToken | null> {
        const registro = this.registros.find((r) => r.tokenHash === tokenHash);
        return registro ? { ...registro } : null;
    }

    async revogar(codigo: string): Promise<boolean> {
        const registro = this.registros.find((r) => r.codigo === codigo);
        if (!registro || registro.revogadoEm) return false;
        registro.revogadoEm = new Date();
        return true;
    }

    async girar(codigo: string): Promise<boolean> {
        const registro = this.registros.find((r) => r.codigo === codigo);
        if (!registro || registro.revogadoEm) return false;
        registro.revogadoEm = new Date();
        registro.girado = true;
        return true;
    }

    async revogarTodosDoUsuario(codigoUsuario: string): Promise<void> {
        for (const registro of this.registros) {
            if (registro.codigoUsuario === codigoUsuario && !registro.revogadoEm) registro.revogadoEm = new Date();
        }
    }
}
