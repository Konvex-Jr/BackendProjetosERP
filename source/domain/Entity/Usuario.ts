import { v4 as uuid } from "uuid";
import PerfilUsuario from "../Enum/PerfilUsuario";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import SenioridadeUsuario from "./SenioridadeUsuario";

export default class Usuario {
    readonly codigo: string;
    readonly nome: string;
    readonly email: string;
    readonly perfil: PerfilUsuario;
    readonly senioridade: SenioridadeUsuario | null;
    readonly ativo: boolean;
    readonly senha: string;

    constructor(
        nome: string,
        email: string,
        perfil: PerfilUsuario,
        ativo: boolean,
        senha: string,
        senioridade: SenioridadeUsuario | null = null,
        codigo?: string,
    ) {
        this.codigo = codigo ?? uuid();
        this.nome = nome;
        this.email = email;
        this.perfil = perfil;
        this.ativo = ativo;
        this.senha = senha;
        this.senioridade = senioridade;

        this.validar();
    }

    private validar(): void {
        if (!this.nome.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.NOME_OBRIGATORIO,
                "NOME_OBRIGATORIO",
            );
        }

        if (!this.email.trim()) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.EMAIL_OBRIGATORIO,
                "EMAIL_OBRIGATORIO",
            );
        }

        if (
            this.perfil === PerfilUsuario.MEMBRO &&
            !this.senioridade
        ) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.SENIORIDADE_OBRIGATORIA,
                "SENIORIDADE_OBRIGATORIA",
            );
        }

        if (
            this.perfil !== PerfilUsuario.MEMBRO &&
            this.senioridade !== null
        ) {
            throw new ErroValidacao(
                MENSAGENS_DE_ERRO.VALIDACAO.SENIORIDADE_INCOMPATIVEL,
                "SENIORIDADE_INCOMPATIVEL",
            );
        }
    }
}