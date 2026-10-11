export default interface EnviarFeedbackCapacitacaoInput {
    codigoCapacitacao: string;
    codigoUsuario: string;
    nota: number;
    bom?: string | null;
    melhorar?: string | null;
    data?: Date;
}
