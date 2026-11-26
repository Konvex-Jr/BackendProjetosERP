import PermissoesRepositoryInterface, { ConjuntoPermissoes } from "../../../domain/interfaces/PermissoesRepositoryInterface";
import { Permissao } from "../../../shared/seguranca/catalogoPermissoes";
import ConexaoBanco from "../../database/ConexaoBanco";

export default class PermissoesRepositoryDatabase implements PermissoesRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async conjunto(nome: ConjuntoPermissoes): Promise<Permissao[]> {
        const linhas = await this.conexao.consultar("SELECT permissao FROM conjunto_permissoes WHERE conjunto = $1 ORDER BY permissao", [
            nome,
        ]);
        return linhas.map((l: any) => l.permissao as Permissao);
    }

    async gravarConjunto(nome: ConjuntoPermissoes, permissoes: readonly Permissao[]): Promise<void> {
        await this.conexao.transacao(async (conexao) => {
            await conexao.consultar("DELETE FROM conjunto_permissoes WHERE conjunto = $1", [nome]);
            if (permissoes.length === 0) return;
            await conexao.consultar("INSERT INTO conjunto_permissoes (conjunto, permissao) SELECT $1, unnest($2::text[])", [
                nome,
                [...new Set(permissoes)],
            ]);
        });
    }
}
