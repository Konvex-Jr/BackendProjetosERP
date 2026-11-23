import { RegrasPrecificacao, REGRAS_PADRAO } from "../../../domain/entity/RegrasPrecificacao";
import RegrasPrecificacaoRepositoryInterface from "../../../domain/interfaces/RegrasPrecificacaoRepositoryInterface";

export default class RegrasPrecificacaoRepositoryMemory implements RegrasPrecificacaoRepositoryInterface {
    private regras: RegrasPrecificacao = structuredClone(REGRAS_PADRAO);

    async obter(): Promise<RegrasPrecificacao> {
        return structuredClone(this.regras);
    }

    async salvar(regras: RegrasPrecificacao): Promise<void> {
        this.regras = structuredClone(regras);
    }
}
