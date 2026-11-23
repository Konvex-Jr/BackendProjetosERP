import { RegrasPrecificacao } from "../entity/RegrasPrecificacao";

/** Regras da simulação de precificação (uma linha só; sem linha, o padrão). */
export default interface RegrasPrecificacaoRepositoryInterface {
    obter(): Promise<RegrasPrecificacao>;
    salvar(regras: RegrasPrecificacao): Promise<void>;
}
