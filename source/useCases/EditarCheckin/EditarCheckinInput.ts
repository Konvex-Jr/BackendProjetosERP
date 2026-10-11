export default interface EditarCheckinInput {
    codigoUsuario: string;
    semana: Date;
    resumo: string;
    aprendizados: string;
    humor: number;
    sentimento?: string | null;
}
