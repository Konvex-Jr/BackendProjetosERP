import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoAutorizado } from "../../shared/erros/ErroNaoAutorizado";
import { emitirLembrete, emitirSessao, hashToken, Lembrete, Sessao } from "./emitirSessao";

/**
 * "Manter conectado" (sessão 25a): troca o lembrete do cookie por uma sessão de aba nova e um
 * lembrete novo com o mesmo prazo (15 dias do login, sem renovar). O lembrete usado é revogado;
 * reapresentar um já girado encerra todas as sessões da pessoa, como no refresh.
 */
export default class RetomarSessao {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(tokenLembrete: string | undefined): Promise<{ sessao: Sessao; lembrete: Lembrete }> {
        const expirada = () => new ErroNaoAutorizado("Sessão expirada. Entre novamente.");
        if (!tokenLembrete || typeof tokenLembrete !== "string") throw expirada();
        const tokens = this.factory.criarRefreshTokenRepository();
        const registro = await tokens.buscarPorHash(hashToken(tokenLembrete));
        // Refresh de aba não serve aqui (e não é revogado por isso).
        if (!registro || !registro.lembrar) throw expirada();

        if (registro.revogadoEm) {
            // Só o girado indica vazamento; revogado por logout, troca de senha ou inativação é só 401.
            if (registro.girado) await tokens.revogarTodosDoUsuario(registro.codigoUsuario);
            throw expirada();
        }
        if (registro.expiraEm.getTime() <= Date.now()) {
            await tokens.revogar(registro.codigo);
            throw expirada();
        }

        const usuario = await this.factory.criarUsuarioRepository().buscarPorCodigo(registro.codigoUsuario);
        // Revoga antes de conferir a pessoa: o lembrete usado não vale de novo em nenhum caso.
        // Duas chamadas simultâneas com o mesmo token: só a primeira marca; a outra é reapresentação.
        if (!(await tokens.girar(registro.codigo))) {
            const atual = await tokens.buscarPorHash(registro.tokenHash);
            if (atual?.girado) await tokens.revogarTodosDoUsuario(registro.codigoUsuario);
            throw expirada();
        }
        if (!usuario || !usuario.ativo) throw expirada();

        const lembrete = await emitirLembrete(this.factory, usuario, registro.expiraEm);
        return { sessao: await emitirSessao(this.factory, usuario), lembrete };
    }
}
