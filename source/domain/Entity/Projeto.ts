import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import Usuario from "./Usuario";
import StatusProjeto from "../Enum/StatusProjeto";

export default class Projeto {
    readonly codigo: string;
    readonly nome: string;
    readonly descricao: string;
    readonly dataInicio: Date;
    readonly dataFim: Date;
    readonly status: StatusProjeto;
    readonly membros: Usuario[];

    constructor(
        nome: string,
        descricao: string,
        dataInicio: Date,
        dataFim: Date,
        status: StatusProjeto = StatusProjeto.EM_EXECUCAO,
        membros: Usuario[] = [],
        codigo?: string,
    ) {
        this.codigo = codigo ?? uuid();
        this.nome = nome;
        this.descricao = descricao;
        this.dataInicio = dataInicio;
        this.dataFim = dataFim;
        this.status = status;
        this.membros = membros;

        this.validar();
    }

    private validar(): void {
        if (!this.nome.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.NOME_OBRIGATORIO,
                "NOME_PROJETO_OBRIGATORIO",
            );
        }

        if (!this.descricao.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.CAMPO_OBRIGATORIO,
                "DESCRICAO_PROJETO_OBRIGATORIA",
            );
        }

        if (
            Number.isNaN(this.dataInicio.getTime()) ||
            Number.isNaN(this.dataFim.getTime())
        ) {
            throw new ErroValidacao(
                "As datas do projeto devem ser válidas.",
                "DATA_PROJETO_INVALIDA",
            );
        }

        if (this.dataFim.getTime() < this.dataInicio.getTime()) {
            throw new ErroValidacao(
                "A data de fim não pode ser anterior à data de início.",
                "PERIODO_PROJETO_INVALIDO",
            );
        }

        const codigosMembros = this.membros.map((membro) => membro.codigo);
        if (new Set(codigosMembros).size !== codigosMembros.length) {
            throw new ErroValidacao(
                "O projeto não pode ter membros duplicados.",
                "MEMBRO_DUPLICADO_PROJETO",
            );
        }
    }
}
