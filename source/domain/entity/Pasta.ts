import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import SigiloPasta, { ehSigiloPasta } from "../enum/SigiloPasta";

/** Projeto ligado a uma pasta de sigilo "projeto" (só o necessário para exibir). */
export interface ProjetoDaPasta {
    codigo: string;
    nome: string;
}

/**
 * Pasta de documentos. O sigilo vale para a pasta inteira (ver SigiloPasta); o projeto só é
 * guardado quando o sigilo é "projeto" e é descartado nos demais.
 */
export default class Pasta {
    readonly codigo: string;
    readonly nome: string;
    readonly sigilo: SigiloPasta;
    readonly projeto: ProjetoDaPasta | null;

    constructor(nome: string, codigo?: string, sigilo: SigiloPasta | string = SigiloPasta.TODOS, projeto: ProjetoDaPasta | null = null) {
        this.codigo = codigo ?? uuid();
        this.nome = nome;
        this.sigilo = sigilo as SigiloPasta;
        this.projeto = sigilo === SigiloPasta.PROJETO ? projeto : null;

        this.validar();
    }

    private validar(): void {
        if (!this.nome.trim()) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.VALIDACAO.NOME_OBRIGATORIO, "NOME_PASTA_OBRIGATORIO");
        }

        if (this.nome.length > 120) {
            throw new ErroValidacao("O nome da pasta deve ter no máximo 120 caracteres.", "NOME_PASTA_MUITO_LONGO");
        }

        if (!ehSigiloPasta(this.sigilo)) {
            throw new ErroValidacao("Sigilo inválido. Use todos, gestao ou projeto.", "SIGILO_PASTA_INVALIDO");
        }

        if (this.sigilo === SigiloPasta.PROJETO && !this.projeto) {
            throw new ErroValidacao("Escolha o projeto da pasta.", "PASTA_SEM_PROJETO");
        }
    }
}
