/** RF-011. Ativo e Trainee entram no sistema (trainee desde a sessão 20; antes só o Ativo). */
enum StatusPessoa {
    ATIVO = "ativo",
    TRAINEE = "trainee",
    ALUMNI = "alumni",
    INATIVO = "inativo",
}

/** Quem pode fazer login. */
export const STATUS_COM_ACESSO: StatusPessoa[] = [StatusPessoa.ATIVO, StatusPessoa.TRAINEE];
/** Quem está na EJ e pode ser colocado em projetos. */
export const STATUS_NA_EJ: StatusPessoa[] = [StatusPessoa.ATIVO, StatusPessoa.TRAINEE];
export const STATUS_DE_SAIDA: StatusPessoa[] = [StatusPessoa.ALUMNI, StatusPessoa.INATIVO];

export default StatusPessoa;
