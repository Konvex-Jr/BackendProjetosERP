import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoAutorizado } from "../../shared/erros/ErroNaoAutorizado";
import { emitirSessao, hashToken, Sessao } from "./emitirSessao";

/**
 * Troca um refresh token válido por uma sessão nova. O token usado é revogado (rotação).
 * Se um token já revogado for reapresentado, todas as sessões da pessoa são encerradas,
 * porque isso indica que o token pode ter vazado.
 */
export default class RenovarSessao {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(refreshToken: string): Promise<Sessao> {
        if (!refreshToken || typeof refreshToken !== "string") {
            throw new ErroNaoAutorizado("Sessão expirada. Entre novamente.");
        }
        const tokens = this.factory.criarRefreshTokenRepository();
        const registro = await tokens.buscarPorHash(hashToken(refreshToken));
        // O lembrete do "Manter conectado" só vale em POST /auth/retomar (cookie), nunca no corpo.
        if (!registro || registro.lembrar) throw new ErroNaoAutorizado("Sessão expirada. Entre novamente.");

        if (registro.revogadoEm) {
            await tokens.revogarTodosDoUsuario(registro.codigoUsuario);
            throw new ErroNaoAutorizado("Sessão expirada. Entre novamente.");
        }
        if (registro.expiraEm.getTime() <= Date.now()) {
            await tokens.revogar(registro.codigo);
            throw new ErroNaoAutorizado("Sessão expirada. Entre novamente.");
        }

        const usuario = await this.factory.criarUsuarioRepository().buscarPorCodigo(registro.codigoUsuario);
        // Revoga antes de conferir a pessoa: o token usado não vale de novo em nenhum caso.
        // Duas chamadas simultâneas com o mesmo token: só a primeira marca; a outra é reapresentação.
        if (!(await tokens.revogar(registro.codigo))) {
            await tokens.revogarTodosDoUsuario(registro.codigoUsuario);
            throw new ErroNaoAutorizado("Sessão expirada. Entre novamente.");
        }
        if (!usuario || !usuario.ativo) throw new ErroNaoAutorizado("Sessão expirada. Entre novamente.");

        return emitirSessao(this.factory, usuario);
    }
}
