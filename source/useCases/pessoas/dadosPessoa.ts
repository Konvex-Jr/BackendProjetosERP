import Usuario, { DetalhesPessoa, URL_VALIDA } from "../../domain/entity/Usuario";
import PerfilUsuario from "../../domain/enum/PerfilUsuario";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import StatusPessoa from "../../domain/enum/StatusPessoa";
import { ehCursoValido, CURSOS } from "../../domain/enum/Curso";
import { hoje } from "../../shared/datas";
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
    ingresso?: string | null;
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
        "ingresso",
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

/** Dia civil da data (as datas da pessoa são meia-noite UTC; um horário no meio do dia cai no mesmo dia). */
const dia = (d: Date | null | undefined) => (d ? Date.parse(d.toISOString().slice(0, 10)) : null);

/**
 * Confere curso, telefone e fim do trainee só quando o campo muda: pessoa antiga com valor fora da
 * regra continua editando outros campos. `atual = null` na criação (tudo conta como alterado).
 */
export function conferirCamposAlterados(atual: Usuario | null, detalhes: DetalhesPessoa): void {
    const M = MENSAGENS_DE_ERRO.USUARIO;
    if (atual === null || detalhes.curso !== undefined) {
        const curso = typeof detalhes.curso === "string" ? detalhes.curso.trim() : "";
        // Vazio em quem já não tem curso = campo não mudou (tela antiga manda todos os campos).
        const semMudanca = !curso && atual !== null && !atual.curso;
        if (!curso && !semMudanca) throw new ErroValidacao(M.CURSO_OBRIGATORIO, "CURSO_OBRIGATORIO");
        if (curso && curso !== (atual?.curso ?? null) && !ehCursoValido(curso)) {
            throw new ErroValidacao(M.CURSO_INVALIDO(CURSOS), "CURSO_INVALIDO");
        }
    }

    if (detalhes.telefone !== undefined && detalhes.telefone !== null && String(detalhes.telefone).trim() !== "") {
        const telefone = String(detalhes.telefone);
        if (telefone !== (atual?.telefone ?? null)) {
            const digitos = telefone.replace(/\D/g, "").length;
            if (digitos < 10 || digitos > 11) throw new ErroValidacao(M.TELEFONE_INVALIDO, "TELEFONE_INVALIDO");
        }
    }

    if (detalhes.ingresso !== undefined && detalhes.ingresso !== null && String(detalhes.ingresso).trim() !== "") {
        const ingresso = String(detalhes.ingresso).trim();
        if (ingresso !== (atual?.ingresso ?? null) && !ingressoValido(ingresso)) {
            throw new ErroValidacao(M.INGRESSO_INVALIDO, "INGRESSO_INVALIDO");
        }
    }

    const fim = detalhes.fimTrainee !== undefined ? detalhes.fimTrainee : (atual?.fimTrainee ?? null);
    const entrada = detalhes.dataEntrada !== undefined ? detalhes.dataEntrada : (atual?.dataEntrada ?? null);
    const mudouFim = detalhes.fimTrainee !== undefined && dia(detalhes.fimTrainee) !== dia(atual?.fimTrainee);
    const mudouEntrada = detalhes.dataEntrada !== undefined && dia(detalhes.dataEntrada) !== dia(atual?.dataEntrada);
    if (fim && (mudouFim || mudouEntrada)) {
        if (entrada && dia(fim)! < dia(entrada)!) {
            throw new ErroValidacao(M.FIM_TRAINEE_ANTES_DA_ENTRADA, "FIM_TRAINEE_ANTES_DA_ENTRADA");
        }
    }
    if (fim && mudouFim) {
        if (dia(fim)! > hoje().getTime()) throw new ErroValidacao(M.FIM_TRAINEE_NO_FUTURO, "FIM_TRAINEE_NO_FUTURO");
        const status = detalhes.status ?? atual?.status;
        if (status === StatusPessoa.TRAINEE) throw new ErroValidacao(M.FIM_TRAINEE_COM_TRAINEE, "FIM_TRAINEE_COM_TRAINEE");
    }
}

/** `AAAA/1` ou `AAAA/2`, ano a partir de 2000, não depois do semestre atual (jan-jun = 1, jul-dez = 2). */
export function ingressoValido(valor: string, agora: Date = hoje()): boolean {
    if (!/^\d{4}\/[12]$/.test(valor)) return false;
    const ano = Number(valor.slice(0, 4));
    const semestre = Number(valor.slice(5));
    if (ano < 2000) return false;
    const h = agora;
    const anoAtual = h.getUTCFullYear();
    const semestreAtual = h.getUTCMonth() < 6 ? 1 : 2;
    return ano < anoAtual || (ano === anoAtual && semestre <= semestreAtual);
}

/**
 * Campos obrigatórios do perfil que a pessoa ainda não preencheu (ou que estão fora da regra), na ordem
 * da tela. Só para quem tem login; a tela bloqueia até completar, o back só informa.
 */
export function pendenciasPerfil(u: Usuario): string[] {
    if (!u.ativo) return [];
    const pendentes: string[] = [];
    if (!u.curso || !ehCursoValido(u.curso)) pendentes.push("curso");
    const digitos = (u.telefone ?? "").replace(/\D/g, "").length;
    if (digitos < 10 || digitos > 11) pendentes.push("telefone");
    if (!u.emailPessoal) pendentes.push("emailPessoal");
    if (!u.ingresso || !ingressoValido(u.ingresso)) pendentes.push("ingresso");
    if (!u.calendarioUrl || !URL_VALIDA.test(u.calendarioUrl)) pendentes.push("calendarioUrl");
    return pendentes;
}
