import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

export default class ItemChecklistTarefa {
    readonly codigo: string;
    readonly texto: string;
    readonly feito: boolean;

    constructor(
        texto: string,
        feito: boolean = false,
        codigo?: string,
    ) {
        this.codigo = codigo ?? uuid();
        this.texto = texto;
        this.feito = feito;

        this.validar();
    }

    private validar(): void {
        if (!this.texto.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "TEXTO_CHECKLIST_OBRIGATORIO",
            );
        }

        if (this.texto.length > 300) {
            throw new ErroValidacao(
                "O item do checklist deve ter no máximo 300 caracteres.",
                "TEXTO_CHECKLIST_MUITO_LONGO",
            );
        }
    }
}
