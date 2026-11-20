import LinkSenhaRepositoryInterface, { RegistroLinkSenha, TipoLink } from "../../../domain/interfaces/LinkSenhaRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";

/** Links de senha no PostgreSQL. Nada é apagado, só marcado como usado. */
export default class LinkSenhaRepositoryDatabase implements LinkSenhaRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async criar(r: RegistroLinkSenha): Promise<void> {
        await this.conexao.consultar(
            `INSERT INTO links_senha (codigo, usuario_codigo, tipo, token_hash, expira_em, usado_em)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [r.codigo, r.codigoUsuario, r.tipo, r.tokenHash, r.expiraEm, r.usadoEm],
        );
    }

    async buscarPorHash(tokenHash: string): Promise<RegistroLinkSenha | null> {
        const linhas = await this.conexao.consultar(
            "SELECT codigo, usuario_codigo, tipo, token_hash, expira_em, usado_em FROM links_senha WHERE token_hash = $1",
            [tokenHash],
        );
        if (!linhas.length) return null;
        const l = linhas[0];
        return {
            codigo: l.codigo,
            codigoUsuario: l.usuario_codigo,
            tipo: l.tipo as TipoLink,
            tokenHash: l.token_hash,
            expiraEm: l.expira_em,
            usadoEm: l.usado_em,
        };
    }

    async invalidarDoUsuario(codigoUsuario: string, tipo?: TipoLink): Promise<void> {
        await this.conexao.consultar(
            "UPDATE links_senha SET usado_em = now() WHERE usuario_codigo = $1 AND usado_em IS NULL AND ($2::text IS NULL OR tipo = $2)",
            [codigoUsuario, tipo ?? null],
        );
    }

    async marcarUsado(codigo: string): Promise<boolean> {
        const linhas = await this.conexao.consultar(
            "UPDATE links_senha SET usado_em = now() WHERE codigo = $1 AND usado_em IS NULL RETURNING codigo",
            [codigo],
        );
        return linhas.length > 0;
    }
}
