export const MENSAGENS_DE_ERRO = {
    VALIDACAO: {
        SENHA_CURTA: "A senha deve possuir pelo menos 6 caracteres.",
        EMAIL_INVALIDO: "O e-mail informado é inválido.",
        CAMPO_OBRIGATORIO: "O campo é obrigatório.",
        NOME_OBRIGATORIO: "O nome do usuário é obrigatório.",
        EMAIL_OBRIGATORIO: "O e-mail do usuário é obrigatório.",
        SENIORIDADE_OBRIGATORIA: "A senioridade é obrigatória para todos os perfis.",
        SENIORIDADE_INCOMPATIVEL: "A senioridade informada não é compatível com o usuário.",
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

    PROJETO: {
        NOME_OBRIGATORIO: "O nome do projeto é obrigatório.",
        DESCRICAO_OBRIGATORIA: "A descrição do projeto é obrigatória.",
    },

    TAREFA: {
        TITULO_OBRIGATORIO: "O título da tarefa é obrigatório.",
        PRIORIDADE_INVALIDA: "Prioridade inválida. Use P1, P2, P3 ou P4.",
        STATUS_INVALIDO: "Situação inválida. Use pendente, andamento ou concluida.",
    },

    CONHECIMENTO: {
        TITULO_OBRIGATORIO: "O título do item é obrigatório.",
        TITULO_LONGO: "O título do item deve ter no máximo 160 caracteres.",
        RESUMO_OBRIGATORIO: "O resumo do item é obrigatório.",
        RESUMO_LONGO: "O resumo do item deve ter no máximo 500 caracteres.",
        CONTEUDO_LONGO: "O conteúdo do item deve ter no máximo 50.000 caracteres.",
        FONTE_LONGA: "A fonte do item deve ter no máximo 300 caracteres.",
        MUITAS_TAGS: "Use no máximo 10 tags, com até 40 caracteres cada.",
        MUITOS_LINKS: "Use no máximo 10 links.",
        NAO_ENCONTRADO: "Item da Base de Inteligência não encontrado.",
        SEM_PERMISSAO: "Só quem cadastrou o item ou a gestão pode alterá-lo ou excluí-lo.",
    },

    INICIATIVA: {
        TITULO_OBRIGATORIO: "O título da iniciativa é obrigatório.",
        TITULO_LONGO: "O título da iniciativa deve ter no máximo 160 caracteres.",
        DESCRICAO_LONGA: "A descrição da iniciativa deve ter no máximo 20.000 caracteres.",
        RESULTADO_LONGO: "O resultado da iniciativa deve ter no máximo 10.000 caracteres.",
        APRENDIZADOS_LONGOS: "Os aprendizados da iniciativa devem ter no máximo 10.000 caracteres.",
        PERIODO_INVALIDO: "A data de fim da iniciativa não pode ser anterior à de início.",
        NAO_ENCONTRADA: "Iniciativa não encontrada.",
        SEM_PERMISSAO_CRIAR: "Só a gestão e quem é da área de Inovação podem criar iniciativas.",
        SEM_PERMISSAO: "Só o responsável, quem criou a iniciativa ou a gestão podem alterá-la ou excluí-la.",
        SO_EM_INOVACAO: "Só tarefas avulsas da categoria Inovação podem ser ligadas a uma iniciativa.",
    },

    GERAL: {
        ERRO_INTERNO: "Ocorreu um erro interno.",
        RECURSO_NAO_ENCONTRADO: "Recurso não encontrado.",
    },
} as const;