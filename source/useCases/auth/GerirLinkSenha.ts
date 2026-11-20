import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import Usuario from "../../domain/entity/Usuario";
import { TipoLink } from "../../domain/interfaces/LinkSenhaRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { validarConfirmacao, validarNovaSenha } from "../../shared/seguranca/regraSenha";
import { emitirSessao, hashToken, Sessao } from "./emitirSessao";
import { emailConvite, emailRedefinir, emailSenhaAlterada, linkSenha } from "./textosEmail";

export { TipoLink };

export const HORAS_CONVITE = 72;
export const HORAS_REDEFINIR = 1;

/** Link de uso único para definir a senha: convite (72 h) ou redefinição (1 h). O token nunca é guardado, só o hash. */
export default class GerirLinkSenha {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    /** Cria o link, invalida os abertos do mesmo tipo e envia o e-mail. `false` se o envio falhou. */
    async emitir(usuario: Usuario, tipo: TipoLink): Promise<boolean> {
        const links = this.factory.criarLinkSenhaRepository();
        await links.invalidarDoUsuario(usuario.codigo, tipo);
        const token = randomBytes(32).toString("base64url");
        const horas = tipo === "convite" ? HORAS_CONVITE : HORAS_REDEFINIR;
        await links.criar({
            codigo: uuid(),
            codigoUsuario: usuario.codigo,
            tipo,
            tokenHash: hashToken(token),
            expiraEm: new Date(Date.now() + horas * 60 * 60 * 1000),
            usadoEm: null,
        });
        const texto = tipo === "convite" ? emailConvite : emailRedefinir;
        try {
            await this.factory.criarEnvioEmail().enviar({ para: usuario.email, ...texto(usuario.nome, linkSenha(token)) });
            return true;
        } catch {
            console.error(`Falha ao enviar e-mail de ${tipo} para ${usuario.codigo}`);
            return false;
        }
    }

    async consultar(token: string): Promise<{ tipo: TipoLink; primeiroNome: string }> {
        const { link, usuario } = await this.carregar(token);
        return { tipo: link.tipo, primeiroNome: (usuario.nomeExibicao ?? usuario.nome).trim().split(/\s+/)[0] };
    }

    async usar(token: string, senha: unknown, confirmacao: unknown): Promise<Sessao> {
        // Valida antes de gastar o link: senha fraca não obriga a pedir outro.
        const nova = validarNovaSenha(senha);
        validarConfirmacao(nova, confirmacao);
        const { link, usuario } = await this.carregar(token);
        const links = this.factory.criarLinkSenhaRepository();
        if (!(await links.marcarUsado(link.codigo))) throw invalido();

        const salva = await this.factory.criarUsuarioRepository().editar(usuario.copiar({ senha: await hash(nova, 10) }));
        await links.invalidarDoUsuario(usuario.codigo);
        await this.factory.criarRefreshTokenRepository().revogarTodosDoUsuario(usuario.codigo);
        try {
            await this.factory.criarEnvioEmail().enviar({ para: usuario.email, ...emailSenhaAlterada(usuario.nome) });
        } catch {
            console.error(`Falha ao enviar aviso de senha alterada para ${usuario.codigo}`);
        }
        return emitirSessao(this.factory, salva);
    }

    private async carregar(token: string) {
        const link =
            typeof token === "string" && token ? await this.factory.criarLinkSenhaRepository().buscarPorHash(hashToken(token)) : null;
        if (!link || link.usadoEm || link.expiraEm.getTime() <= Date.now()) throw invalido();
        const usuario = await this.factory.criarUsuarioRepository().buscarPorCodigo(link.codigoUsuario);
        if (!usuario || !usuario.ativo) throw invalido();
        return { link, usuario };
    }
}

function invalido(): ErroValidacao {
    return new ErroValidacao(MENSAGENS_DE_ERRO.AUTENTICACAO.LINK_SENHA_INVALIDO, "LINK_SENHA_INVALIDO");
}
