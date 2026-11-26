import { PercentualPorDificuldade } from "../enum/DificuldadeTarefa";

/** % do dia que cada nível de dificuldade vale (uma linha por nível; sempre os quatro; tabela horas_dificuldade). */
export default interface HorasDificuldadeRepositoryInterface {
    listar(): Promise<PercentualPorDificuldade>;
    salvar(horas: PercentualPorDificuldade): Promise<void>;
}
