import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";

/** Área da Konvex, em hierarquia (ADR-007). */
export default class Area {
    readonly codigo: string;
    readonly nome: string;
    readonly codigoAreaPai: string | null;
    readonly ativa: boolean;
    /** A área tem projeto geral (sessão 24b). Desligado, o geral é excluído e não volta. */
    readonly temGeral: boolean;

    constructor(nome: string, codigoAreaPai: string | null = null, ativa = true, codigo?: string, temGeral = true) {
        this.codigo = codigo ?? uuid();
        this.nome = (nome ?? "").trim();
        this.codigoAreaPai = codigoAreaPai || null;
        this.ativa = ativa;
        this.temGeral = temGeral;
        if (!this.nome) throw new ErroValidacao("O nome da área é obrigatório.", "NOME_AREA_OBRIGATORIO");
        if (this.nome.length > 80) throw new ErroValidacao("O nome da área deve ter até 80 caracteres.", "NOME_AREA_LONGO");
        if (this.codigoAreaPai === this.codigo) {
            throw new ErroValidacao("Uma área não pode ser superior a si mesma.", "AREA_CICLICA");
        }
    }
}
