import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

/** Teto de horas por semana de quem não tem cargo (e padrão de cargo novo). */
export const TETO_SEM_CARGO = 10;

/** Cargo configurável (ADR-007, doc 04 QA-29). */
export default class Cargo {
    readonly codigo: string;
    readonly nome: string;
    readonly ativo: boolean;
    /** Quem tem este cargo numa área a lidera (spec 23). */
    readonly lideraArea: boolean;
    /** Horas de tarefa por semana que a pessoa deste cargo aguenta (1 a 40; sessão 24a). */
    readonly tetoSemanalHoras: number;

    constructor(nome: string, ativo = true, codigo?: string, lideraArea = false, tetoSemanalHoras = TETO_SEM_CARGO) {
        this.codigo = codigo ?? uuid();
        this.nome = (nome ?? "").trim();
        this.ativo = ativo;
        this.lideraArea = lideraArea;
        this.tetoSemanalHoras = tetoSemanalHoras;
        if (!this.nome) throw new ErroValidacao("O nome do cargo é obrigatório.", "NOME_CARGO_OBRIGATORIO");
        if (this.nome.length > 80) throw new ErroValidacao("O nome do cargo deve ter até 80 caracteres.", "NOME_CARGO_LONGO");
        if (!Number.isInteger(tetoSemanalHoras) || tetoSemanalHoras < 1 || tetoSemanalHoras > 40) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.CARGO.TETO_INVALIDO, "TETO_INVALIDO");
        }
    }
}
