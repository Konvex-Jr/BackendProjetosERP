/** Referência curta (só o necessário para exibir). */
export interface Referencia {
    codigo: string;
    nome: string;
    /** Arquivo da foto (sessão 22), quando a consulta traz; sem foto, a tela mostra as iniciais. */
    foto?: string | null;
}
