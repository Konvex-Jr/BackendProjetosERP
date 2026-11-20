import { DetalhesPessoa } from "../../domain/entity/Usuario";
import PerfilUsuario from "../../domain/enum/PerfilUsuario";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import StatusPessoa from "../../domain/enum/StatusPessoa";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";

/** Campos do perfil como chegam na API (todos opcionais; ausente = não alterar). */
export interface EntradaPerfilPessoa {
    nomeExibicao?: string | null;
    telefone?: string | null;
    linkedinUrl?: string | null;
    calendarioUrl?: string | null;
    githubUrl?: string | null;
    curso?: string | null;
    emailPessoal?: string | null;
    fimTrainee?: Date | null;
    semestre?: number | null;
    dataEntrada?: Date | null;
    bio?: string | null;
}

/**
 * Converte a entrada da API em DetalhesPessoa. Área e cargo não vêm mais daqui: são períodos
 * (sessão 23a); `codigoArea` e `codigoCargo` enviados por tela antiga são ignorados.
 */
export function resolverPerfilPessoa(entrada: EntradaPerfilPessoa): DetalhesPessoa {
    const detalhes: DetalhesPessoa = {};
    const copiar = [
        "nomeExibicao",
        "telefone",
        "linkedinUrl",
        "calendarioUrl",
        "githubUrl",
        "curso",
        "emailPessoal",
        "fimTrainee",
        "semestre",
        "dataEntrada",
        "bio",
    ] as const;
    for (const campo of copiar) {
        if (entrada[campo] !== undefined) (detalhes as any)[campo] = entrada[campo];
    }

    return detalhes;
}

/** Trainee (sessão 20) é sempre membro: 400 se o status for trainee e o perfil, outro. */
export function exigirTraineeMembro(status: StatusPessoa | string, perfil: PerfilUsuario | string): void {
    if (status === StatusPessoa.TRAINEE && perfil !== PerfilUsuario.MEMBRO) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.TRAINEE_SO_MEMBRO, "TRAINEE_SO_MEMBRO");
    }
}

export function lerStatusPessoa(valor: unknown): StatusPessoa | undefined {
    if (valor === undefined || valor === null || valor === "") return undefined;
    if (!Object.values(StatusPessoa).includes(valor as StatusPessoa)) {
        throw new ErroValidacao("Status de pessoa inválido. Use ativo, trainee ou inativo.", "STATUS_PESSOA_INVALIDO");
    }
    return valor as StatusPessoa;
}

/** E-mail de pessoa nova ou alterado tem de ser do domínio da Konvex. Sem `EMAIL_DOMINIO`, não confere. */
export function exigirDominioKonvex(email: string): void {
    const dominio = (process.env.EMAIL_DOMINIO ?? "").trim().toLowerCase().replace(/^@/, "");
    if (!dominio) return;
    if (!email.trim().toLowerCase().endsWith(`@${dominio}`)) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.EMAIL_FORA_DO_DOMINIO(dominio), "EMAIL_FORA_DO_DOMINIO");
    }
}
