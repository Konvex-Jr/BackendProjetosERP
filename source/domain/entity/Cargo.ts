import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";

/** Cargo configurável (ADR-007, doc 04 QA-29). */
export default class Cargo {
    readonly codigo: string;
    readonly nome: string;
    readonly ativo: boolean;
    /** Quem tem este cargo numa área a lidera (spec 23). */
    readonly lideraArea: boolean;

    constructor(nome: string, ativo = true, codigo?: string, lideraArea = false) {
        this.codigo = codigo ?? uuid();
        this.nome = (nome ?? "").trim();
        this.ativo = ativo;
        this.lideraArea = lideraArea;
        if (!this.nome) throw new ErroValidacao("O nome do cargo é obrigatório.", "NOME_CARGO_OBRIGATORIO");
        if (this.nome.length > 80) throw new ErroValidacao("O nome do cargo deve ter até 80 caracteres.", "NOME_CARGO_LONGO");
    }
}
