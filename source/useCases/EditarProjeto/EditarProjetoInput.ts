export default interface EditarProjetoInput {
    codigo: string;
    nome: string;
    descricao: string;
    dataInicio: Date;
    dataFim: Date;
    codigosMembros: string[];
}
