import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import Pasta from "./Pasta";
import Usuario from "./Usuario";

export default class Documento {
    readonly codigo: string;
    readonly pasta: Pasta;
    readonly nome: string;
    readonly extensao: string | null;
    readonly tamanhoBytes: number;
    readonly dataEnvio: Date;
    readonly autor: Usuario;
    readonly arquivoUrl: string;

    constructor(
        pasta: Pasta,
        nome: string,
        tamanhoBytes: number,
        dataEnvio: Date,
        autor: Usuario,
        arquivoUrl: string,
        extensao: string | null = null,
        codigo?: string,
    ) {
        this.codigo = codigo ?? uuid();
        this.pasta = pasta;
        this.nome = nome;
        this.tamanhoBytes = tamanhoBytes;
        this.dataEnvio = dataEnvio;
        this.autor = autor;
        this.arquivoUrl = arquivoUrl;
        this.extensao = extensao ? extensao.trim().toUpperCase() : null;

        this.validar();
    }

    private validar(): void {
        if (!this.nome.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.NOME_OBRIGATORIO,
                "NOME_DOCUMENTO_OBRIGATORIO",
            );
        }

        if (this.extensao !== null && this.extensao.length > 5) {
            throw new ErroValidacao(
                "A extensão deve ter no máximo 5 caracteres.",
                "EXTENSAO_DOCUMENTO_INVALIDA",
            );
        }

        if (!Number.isInteger(this.tamanhoBytes) || this.tamanhoBytes < 0) {
            throw new ErroValidacao(
                "O tamanho do documento deve ser um inteiro não negativo.",
                "TAMANHO_DOCUMENTO_INVALIDO",
            );
        }

        if (Number.isNaN(this.dataEnvio.getTime())) {
            throw new ErroValidacao(
                "A data de envio deve ser válida.",
                "DATA_ENVIO_INVALIDA",
            );
        }

        if (!this.arquivoUrl.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "ARQUIVO_URL_OBRIGATORIA",
            );
        }
    }
}
