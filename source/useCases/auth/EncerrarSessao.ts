import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { hashToken, revogarLembrete } from "./emitirSessao";

/**
 * Logout: revoga o refresh token da aba e o lembrete do cookie ("Manter conectado"), quando vierem.
 * Não falha se algum já não valer.
 */
export default class EncerrarSessao {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(refreshToken?: string | null, tokenLembrete?: string | null): Promise<void> {
        await revogarLembrete(this.factory, tokenLembrete);
        if (!refreshToken || typeof refreshToken !== "string") return;
        const tokens = this.factory.criarRefreshTokenRepository();
        const registro = await tokens.buscarPorHash(hashToken(refreshToken));
        if (registro) await tokens.revogar(registro.codigo);
    }
}
