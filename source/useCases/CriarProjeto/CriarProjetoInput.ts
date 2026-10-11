import Usuario from "../../domain/Entity/Usuario";
export default interface CriarProjetoInput {
    nome: string;
    descricao: string;
    dataInicio: Date;
    dataFim: Date;
    codigosMembros?: string[];
}
