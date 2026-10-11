export default interface RegistrarCheckinInput {
    codigoUsuario: string;
    semana: Date;
    resumo: string;
    aprendizados: string;
    humor?: number;
    sentimento?: string | null;
}
