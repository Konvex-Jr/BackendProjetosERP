import { RegrasPrecificacao, regrasComPadrao } from "../../../domain/entity/RegrasPrecificacao";
import RegrasPrecificacaoRepositoryInterface from "../../../domain/interfaces/RegrasPrecificacaoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";

export default class RegrasPrecificacaoRepositoryDatabase implements RegrasPrecificacaoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async obter(): Promise<RegrasPrecificacao> {
        const linhas = await this.conexao.consultar("SELECT regras FROM regras_precificacao WHERE id = 1");
        return regrasComPadrao(linhas[0]?.regras);
    }

    async salvar(regras: RegrasPrecificacao): Promise<void> {
        await this.conexao.consultar(
            `INSERT INTO regras_precificacao (id, regras, alterado_em) VALUES (1, $1::jsonb, now())
             ON CONFLICT (id) DO UPDATE SET regras = EXCLUDED.regras, alterado_em = now()`,
            [JSON.stringify(regras)],
        );
    }
}
