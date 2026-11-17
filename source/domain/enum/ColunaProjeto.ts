import StatusTarefa from "./StatusTarefa";

/** Papel da coluna no fluxo do projeto: é ele que define o status da tarefa que está nela. */
export enum PapelColuna {
    ENTRADA = "entrada",
    MEIO = "meio",
    CONCLUIDA = "concluida",
}

export const CORES_COLUNA = ["cinza", "azul", "verde", "amarelo", "laranja", "vermelho", "roxo", "rosa"] as const;
export type CorColuna = (typeof CORES_COLUNA)[number];

export function statusDoPapel(papel: PapelColuna): StatusTarefa {
    if (papel === PapelColuna.CONCLUIDA) return StatusTarefa.CONCLUIDA;
    if (papel === PapelColuna.MEIO) return StatusTarefa.ANDAMENTO;
    return StatusTarefa.PENDENTE;
}
