/**
 * Listas das iniciativas de inovação (sessão 12b). Lugar único: o banco não repete
 * os valores e o frontend lê os rótulos de GET /iniciativas/opcoes.
 */
export interface Opcao {
    readonly valor: string;
    readonly rotulo: string;
}

/** Status decididos em 03/11/2026 (QA-27). */
export const STATUS_INICIATIVA = [
    { valor: "ideia", rotulo: "Ideia" },
    { valor: "andamento", rotulo: "Em andamento" },
    { valor: "pausada", rotulo: "Pausada" },
    { valor: "concluida", rotulo: "Concluída" },
    { valor: "descartada", rotulo: "Descartada" },
] as const;

/** Tipos do RF-091. */
export const TIPOS_INICIATIVA = [
    { valor: "produto", rotulo: "Produto" },
    { valor: "projeto", rotulo: "Projeto" },
    { valor: "processo", rotulo: "Processo" },
    { valor: "servico", rotulo: "Serviço" },
    { valor: "experiencia", rotulo: "Experiência" },
    { valor: "oportunidade", rotulo: "Oportunidade" },
] as const;

/** Frentes do RF-092 (a Base de Inteligência é transversal e não entra como frente). */
export const FRENTES_INICIATIVA = [
    { valor: "radar", rotulo: "Radar de Mercado" },
    { valor: "lab", rotulo: "Konvex Lab" },
    { valor: "esteira", rotulo: "Esteira de Produtos" },
] as const;

export type StatusIniciativa = (typeof STATUS_INICIATIVA)[number]["valor"];
export type TipoIniciativa = (typeof TIPOS_INICIATIVA)[number]["valor"];
export type FrenteIniciativa = (typeof FRENTES_INICIATIVA)[number]["valor"];

export const ehDaLista = (lista: readonly Opcao[], valor: unknown): boolean => lista.some((o) => o.valor === valor);
export const valoresDa = (lista: readonly Opcao[]): string => lista.map((o) => o.valor).join(", ");
