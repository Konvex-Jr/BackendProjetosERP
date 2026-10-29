/** RF-011. Ativo e Trainee têm acesso ao sistema; Alumni e Inativo não. */
enum StatusPessoa {
    ATIVO = "ativo",
    TRAINEE = "trainee",
    ALUMNI = "alumni",
    INATIVO = "inativo",
}

export const STATUS_COM_ACESSO: StatusPessoa[] = [StatusPessoa.ATIVO, StatusPessoa.TRAINEE];
export const STATUS_DE_SAIDA: StatusPessoa[] = [StatusPessoa.ALUMNI, StatusPessoa.INATIVO];

export default StatusPessoa;
