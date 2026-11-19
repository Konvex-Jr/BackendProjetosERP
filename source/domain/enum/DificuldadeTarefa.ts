/** Esforço da tarefa (sessão 24a). Cada nível vale horas, configuráveis em Configurações. */
enum DificuldadeTarefa {
    RAPIDA = "rapida",
    FACIL = "facil",
    MEDIA = "media",
    DIFICIL = "dificil",
}

export default DificuldadeTarefa;

export const NIVEIS_DIFICULDADE: DificuldadeTarefa[] = Object.values(DificuldadeTarefa);

export type HorasPorDificuldade = Record<DificuldadeTarefa, number>;

export const HORAS_PADRAO: HorasPorDificuldade = {
    [DificuldadeTarefa.RAPIDA]: 1,
    [DificuldadeTarefa.FACIL]: 2,
    [DificuldadeTarefa.MEDIA]: 4,
    [DificuldadeTarefa.DIFICIL]: 8,
};
