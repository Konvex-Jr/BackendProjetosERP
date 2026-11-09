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

    CAPACITACAO: {
        TITULO_OBRIGATORIO: "O título da capacitação é obrigatório.",
        TITULO_LONGO: "O título da capacitação deve ter no máximo 200 caracteres.",
        DESCRICAO_LONGA: "A descrição da capacitação deve ter no máximo 10.000 caracteres.",
        DATA_INVALIDA: "Informe uma data válida para a capacitação (AAAA-MM-DD).",
        HORA_INVALIDA: "Informe a hora de início no formato HH:mm (ex.: 18:30).",
        DURACAO_INVALIDA: "A duração deve ser em horas, de 0,5 a 24 (ex.: 1,5).",
        VAGAS_INVALIDAS: "O número de vagas deve ser um inteiro de 1 a 500.",
        VAGAS_MENOR_QUE_INSCRITOS: "Já há mais inscritos do que esse número de vagas. Informe pelo menos o total de inscritos.",
        TIPO_INVALIDO: "Tipo de capacitação inválido. Use computacao, eletrica ou mecanica.",
        SALA_OBRIGATORIA: "Informe a sala ou o local da capacitação.",
        SALA_LONGA: "A sala ou o local deve ter no máximo 60 caracteres.",
        INSTRUTOR_OBRIGATORIO: "Escolha quem vai ministrar a capacitação.",
        INSTRUTOR_INVALIDO: "O instrutor escolhido não existe ou não está ativo.",
        NAO_ENCONTRADA: "Capacitação não encontrada.",
        SEM_PERMISSAO: "Só diretores e gerentes podem criar, editar ou excluir capacitações e marcar presença.",
        JA_INSCRITO: "Você já está inscrito nesta capacitação.",
        LOTADA: "Não há mais vagas nesta capacitação.",
        JA_COMECOU: "Esta capacitação já começou; inscrição e cancelamento não são mais possíveis.",
        NAO_INSCRITO: "Esta pessoa não está inscrita nesta capacitação.",
        PESSOA_INATIVA: "Só pessoas ativas podem se inscrever.",
        PRESENCA_ANTES: "A presença só pode ser marcada depois que a capacitação começar.",
        PRESENCA_FORA_DOS_INSCRITOS: "Só é possível marcar presença de quem está inscrito.",
        NOTA_INVALIDA: "A nota deve ser um número inteiro de 1 a 5.",
        COMENTARIO_LONGO: "Cada comentário da avaliação deve ter no máximo 2.000 caracteres.",
        AVALIAR_SEM_PRESENCA: "Só quem compareceu pode avaliar. A gestão marca a presença depois da capacitação.",
        AVALIAR_ANTES: "A capacitação só pode ser avaliada depois de começar.",
        FEEDBACKS_SEM_PERMISSAO: "As avaliações individuais ficam visíveis só para a gestão e para quem ministrou.",
    },

    ANEXO: {
        DONO_INVALIDO: "Anexo só pode ser de um documento, de um item da Base, de uma iniciativa ou de uma capacitação.",
        NOME_OBRIGATORIO: "Informe o nome do arquivo.",
        NOME_LONGO: "O nome do arquivo deve ter no máximo 255 caracteres.",
        TIPO_NAO_ACEITO: "Tipo de arquivo não aceito. Envie PDF, Word, Excel, PowerPoint, OpenDocument, CSV, TXT, MD, imagem (PNG, JPG, WEBP, GIF) ou ZIP.",
        VAZIO: "O arquivo está vazio.",
        GRANDE_DEMAIS: "O arquivo passa de 20 MB, o tamanho máximo.",
        NAO_ENCONTRADO: "Anexo não encontrado.",
        ARQUIVO_SUMIU: "O arquivo deste anexo não foi encontrado no servidor. Avise a gestão.",
        SEM_PERMISSAO_DOCUMENTO: "Só a gestão pode anexar ou excluir arquivos nas pastas.",
        SEM_PERMISSAO_CAPACITACAO: "Só diretores e gerentes podem anexar ou excluir material das capacitações.",
        DOCUMENTO_E_ARQUIVO: "Este documento é um arquivo, não um link. Para trocar, exclua e envie outro.",
    },

    GERAL: {
        ERRO_INTERNO: "Ocorreu um erro interno.",
        RECURSO_NAO_ENCONTRADO: "Recurso não encontrado.",
    },
} as const;