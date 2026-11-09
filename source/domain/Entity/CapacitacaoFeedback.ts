import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { Referencia } from "./Conhecimento";

export interface DadosFeedback {
    codigoCapacitacao: string;
    usuario: Referencia;
    nota: number;
    bom?: string | null;
    melhorar?: string | null;
    data?: Date;
    codigo?: string;
}

const M = MENSAGENS_DE_ERRO.CAPACITACAO;
const textoOuNulo = (v: unknown) => (v === undefined || v === null || !String(v).trim() ? null : String(v).trim());

/** Avaliação de uma capacitação (nota de 1 a 5 e dois comentários). Quem pode avaliar está no caso de uso. */
export default class CapacitacaoFeedback {
    readonly codigo: string;
    readonly codigoCapacitacao: string;
    readonly usuario: Referencia;
    readonly nota: number;
    readonly bom: string | null;
    readonly melhorar: string | null;
    readonly data: Date;

    constructor(dados: DadosFeedback) {
        this.codigo = dados.codigo ?? uuid();
        this.codigoCapacitacao = dados.codigoCapacitacao;
        this.usuario = dados.usuario;
        this.nota = Number(dados.nota);
        this.bom = textoOuNulo(dados.bom);
        this.melhorar = textoOuNulo(dados.melhorar);
        this.data = dados.data ?? new Date();
        if (!Number.isInteger(this.nota) || this.nota < 1 || this.nota > 5) {
            throw new ErroValidacao(M.NOTA_INVALIDA, "NOTA_FEEDBACK_INVALIDA");
        }
        if ((this.bom?.length ?? 0) > 2000 || (this.melhorar?.length ?? 0) > 2000) {
            throw new ErroValidacao(M.COMENTARIO_LONGO, "COMENTARIO_FEEDBACK_LONGO");
        }
    }
}
