/**
 * Esforço da tarefa (sessão 24a). Desde 25/11 cada nível é uma parte do dia da pessoa (teto semanal ÷ 5),
 * configurável em Configurações: Rápida 25%, Fácil 50%, Média 75%, Difícil 100%.
 */
enum DificuldadeTarefa {
    RAPIDA = "rapida",
    FACIL = "facil",
    MEDIA = "media",
    DIFICIL = "dificil",
}

export default DificuldadeTarefa;

export const NIVEIS_DIFICULDADE: DificuldadeTarefa[] = Object.values(DificuldadeTarefa);

/** % do dia de cada nível (inteiro de 5 a 100). */
export type PercentualPorDificuldade = Record<DificuldadeTarefa, number>;

export const PERCENTUAL_PADRAO: PercentualPorDificuldade = {
    [DificuldadeTarefa.RAPIDA]: 25,
    [DificuldadeTarefa.FACIL]: 50,
    [DificuldadeTarefa.MEDIA]: 75,
    [DificuldadeTarefa.DIFICIL]: 100,
};
