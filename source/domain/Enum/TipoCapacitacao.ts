/** Tipos de capacitação (enum do banco desde a 001). */
enum TipoCapacitacao {
    MECANICA = "mecanica",
    COMPUTACAO = "computacao",
    ELETRICA = "eletrica",
}

export const TIPOS_CAPACITACAO: ReadonlyArray<{ valor: TipoCapacitacao; rotulo: string }> = [
    { valor: TipoCapacitacao.COMPUTACAO, rotulo: "Computação" },
    { valor: TipoCapacitacao.ELETRICA, rotulo: "Elétrica" },
    { valor: TipoCapacitacao.MECANICA, rotulo: "Mecânica" },
];

/** A Konvex fica em São Paulo (UTC-03:00, sem horário de verão desde 2019). */
export const FUSO_KONVEX_HORAS = -3;

export default TipoCapacitacao;
