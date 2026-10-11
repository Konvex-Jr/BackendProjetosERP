export const MENSAGENS_DE_ERRO = {
    VALIDACAO: {
        SENHA_CURTA: "A senha deve possuir pelo menos 6 caracteres.",
        EMAIL_INVALIDO: "O e-mail informado é inválido.",
        CAMPO_OBRIGATORIO: "O campo é obrigatório.",
        NOME_OBRIGATORIO: "O nome do usuário é obrigatório.",
        EMAIL_OBRIGATORIO: "O e-mail do usuário é obrigatório.",
        SENIORIDADE_OBRIGATORIA: "A senioridade é obrigatória para membros.",
        SENIORIDADE_INCOMPATIVEL: "Diretores e gerentes não devem possuir senioridade.",
    },

    AUTENTICACAO: {
        CREDENCIAIS_INVALIDAS: "E-mail ou senha inválidos.",
        ACESSO_NAO_AUTORIZADO: "Acesso não autorizado.",
        TOKEN_EXPIRADO: "O token de acesso expirou.",
    },

    USUARIO: {
        NAO_ENCONTRADO: "Usuário não encontrado.",
        EMAIL_JA_CADASTRADO: "Este e-mail já está cadastrado.",
    },

    GERAL: {
        ERRO_INTERNO: "Ocorreu um erro interno.",
        RECURSO_NAO_ENCONTRADO: "Recurso não encontrado.",
    },
} as const;