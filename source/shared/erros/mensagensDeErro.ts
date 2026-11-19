/**
 * Textos de erro mostrados ao usuário, num lugar só para manter o tom e evitar repetição.
 * Regra da casa: dizer qual campo ou valor está errado e o que é aceito.
 */
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
        SAIDA_NO_FUTURO: "A data de saída (dataSaida) não pode ser no futuro.",
        NAO_ENCONTRADO: "Usuário não encontrado.",
        EMAIL_JA_CADASTRADO: "Este e-mail já está cadastrado.",
        TRAINEE_SO_MEMBRO: "Trainee tem sempre o perfil de membro: troque o perfil para membro ou o status para ativo.",
        STATUS_TRAINEE_SO_NA_ENTRADA: "Trainee é só a etapa de entrada; ninguém volta a ser trainee.",
        TRAINEE_NAO_LIDERA: "Trainee não pode ser líder de projeto.",
        TRAINEE_SEM_BIBLIOTECA: "Trainees não têm acesso à Biblioteca.",
    },

    PROJETO: {
        NOME_OBRIGATORIO: "O nome do projeto é obrigatório.",
        DESCRICAO_OBRIGATORIA: "A descrição do projeto é obrigatória.",
        NAO_ENCONTRADO: "Projeto não encontrado.",
        AREA_OBRIGATORIA_INTERNO: "Projeto interno precisa de uma área.",
        GERAL_FIXO: "O projeto geral da área não pode ser editado, excluído, arquivado nem ficar sigiloso.",
        GERAL_SIGILOSO: "O projeto geral da área não pode ser sigiloso.",
        TIPO_INVALIDO: "O campo tipo deve ser cliente ou interno.",
        GERAL_INTERNO: "O projeto geral da área é sempre interno.",
        SIGILOSO: "Este projeto é sigiloso; você vê só o resumo.",
        SIGILO_SEM_PERMISSAO: "Só o diretor e quem criou o projeto mudam o sigilo.",
        ACESSO_SEM_PERMISSAO: "Só o diretor e quem criou o projeto mudam a lista de acesso.",
        ACESSO_LISTA_INVALIDA: "A lista de acesso (codigos) deve ser uma lista de códigos de pessoas.",
        ACESSO_PESSOA_SEM_LOGIN: (codigo: string, nome?: string) =>
            nome
                ? `${nome} (${codigo}) não tem login: só pessoas Ativas ou Trainees entram na lista de acesso.`
                : `Pessoa não encontrada na lista de acesso: ${codigo}.`,
    },

    HORAS_DIFICULDADE: {
        INVALIDAS: (nivel: string) => `As horas do nível "${nivel}" devem ser um número de 0,5 a 40.`,
    },

    CARGO: {
        TETO_INVALIDO: "O teto semanal do cargo (tetoSemanalHoras) deve ser um número inteiro de 1 a 40 horas.",
    },

    PERIODO: {
        PROPRIO: "Você não pode alterar os próprios períodos de área.",
        INICIO_NO_FUTURO: "O início do período na área não pode ser no futuro.",
        FIM_NO_FUTURO: "O fim do período na área não pode ser no futuro.",
        FIM_NAO_DEPOIS_DO_INICIO: "O fim do período na área deve ser depois do início.",
        SOBREPOSTO: (inicio: string, fim: string | null) =>
            `Já existe um período nesta área que se sobrepõe a este (de ${inicio} ${fim ? `até ${fim}` : "em aberto"}).`,
        SOBREPOSTO_SEM_DATAS: "Já existe um período nesta área que se sobrepõe a este.",
        AREA_INATIVA: "A área informada está inativa.",
        AREA_INATIVA_NAO_REABRE: "A área deste período está inativa: o período não pode ser reaberto. Informe a data de fim.",
        AREA_OBRIGATORIA: "Informe a área do período (campo codigoArea).",
        CARGO_INATIVO: "O cargo informado está inativo.",
        PESSOA_FORA_DA_EJ: "Só pessoas Ativas ou Trainees têm período em aberto; informe a data de fim.",
        FIM_DEPOIS_DA_SAIDA: "O fim do período na área não pode ser depois da saída da pessoa.",
    },

    TAREFA: {
        TITULO_OBRIGATORIO: "O título da tarefa é obrigatório.",
        PRIORIDADE_INVALIDA: "Prioridade inválida. Use P1, P2, P3 ou P4.",
        STATUS_INVALIDO: "Situação inválida. Use pendente, andamento ou concluida.",
        PROJETO_OBRIGATORIO: "Escolha o projeto da tarefa.",
        DIFICULDADE_INVALIDA: "Dificuldade inválida. Use rapida, facil, media ou dificil.",
        SEM_PERMISSAO_MOVER: "Só o responsável pela tarefa, o líder do projeto e a gestão podem mover a tarefa.",
    },

    COLUNA: {
        NOME_INVALIDO: (nome: string) =>
            nome
                ? `O nome da coluna "${nome}" deve ter de 1 a 40 caracteres.`
                : "O nome da coluna é obrigatório e deve ter de 1 a 40 caracteres.",
        COR_INVALIDA: (nome: string) =>
            `A cor da coluna "${nome}" é inválida. Use cinza, azul, verde, amarelo, laranja, vermelho, roxo ou rosa.`,
        PAPEL_INVALIDO: (nome: string) => `O papel da coluna "${nome}" é inválido. Use entrada, meio ou concluida.`,
        QUANTIDADE_INVALIDA: (quantidade: number) => `O projeto deve ter de 2 a 12 colunas (recebeu ${quantidade}).`,
        NOME_REPETIDO: (nome: string) =>
            `Já existe uma coluna chamada "${nome}" neste projeto (maiúsculas e minúsculas contam como iguais).`,
        ENTRADA_UNICA: "O projeto deve ter exatamente uma coluna de entrada.",
        CONCLUIDA_UNICA: "O projeto deve ter exatamente uma coluna concluída.",
        COLUNAS_INVALIDAS:
            "As colunas (colunas) devem ser uma lista de objetos { codigo?, nome, cor, papel } e os destinos (destinos), se enviados, um objeto { codigoDaColunaExcluida: codigoDoDestino }.",
        NAO_EXISTE_MAIS: "A coluna não existe mais neste projeto. Recarregue o quadro.",
        CODIGO_REPETIDO: (codigo: string) => `A coluna "${codigo}" aparece mais de uma vez na lista.`,
        DESTINO_OBRIGATORIO: (nome: string, tarefas: number) =>
            `A coluna "${nome}" tem ${tarefas} ${tarefas === 1 ? "tarefa" : "tarefas"}: informe em destinos para qual coluna elas vão.`,
        DESTINO_INVALIDO: (nome: string) => `O destino da coluna "${nome}" deve ser uma coluna do projeto que continua existindo.`,
        QUADRO_MUDOU: "O quadro mudou enquanto você editava. Recarregue e tente de novo.",
        SEM_PERMISSAO: "Só o líder do projeto e a gestão podem fazer isso.",
    },

    BIBLIOTECA: {
        TITULO_OBRIGATORIO: "O título do item é obrigatório.",
        TITULO_LONGO: "O título do item deve ter no máximo 160 caracteres.",
        CONTEUDO_LONGO: "O conteúdo do item deve ter no máximo 50.000 caracteres.",
        MUITAS_TAGS: "Use no máximo 10 tags, com até 40 caracteres cada.",
        MUITOS_LINKS: "Use no máximo 10 links.",
        SIGILO_INVALIDO: "Sigilo inválido. Use todos, gestao ou projeto.",
        PROJETO_OBRIGATORIO: "O sigilo projeto exige um projeto ligado ao item.",
        NAO_ENCONTRADO: "Item não encontrado.",
        SEM_PERMISSAO: "Só quem cadastrou o item ou a gestão pode alterá-lo ou excluí-lo.",
        SIGILO_SEM_PERMISSAO: "Só a gestão pode usar o sigilo gestão.",
        PROJETO_SEM_PERMISSAO: "Você só pode ligar o item a projetos de que participa ou participou.",
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
        DONO_INVALIDO: "Anexo só pode ser de um item da Biblioteca, de uma capacitação ou de uma tarefa.",
        NOME_OBRIGATORIO: "Informe o nome do arquivo.",
        NOME_LONGO: "O nome do arquivo deve ter no máximo 255 caracteres.",
        TIPO_NAO_ACEITO:
            "Tipo de arquivo não aceito. Envie PDF, Word, Excel, PowerPoint, OpenDocument, CSV, TXT, MD, imagem (PNG, JPG, WEBP, GIF) ou ZIP.",
        VAZIO: "O arquivo está vazio.",
        GRANDE_DEMAIS: "O arquivo passa de 20 MB, o tamanho máximo.",
        NAO_ENCONTRADO: "Anexo não encontrado.",
        ARQUIVO_SUMIU: "O arquivo deste anexo não foi encontrado no servidor. Avise a gestão.",
        SEM_PERMISSAO_CAPACITACAO: "Só diretores e gerentes podem anexar ou excluir material das capacitações.",
        SEM_PERMISSAO_TAREFA_PROJETO: "Só a equipe atual do projeto anexa arquivos nas tarefas.",
        SO_OS_PROPRIOS: "Você só pode excluir os arquivos que enviou.",
    },

    FOTO: {
        FORMATO_INVALIDO: "A foto tem que ser uma imagem JPEG, PNG ou WebP.",
        GRANDE_DEMAIS: "A foto pode ter até 300 KB.",
        NOME_INVALIDO: "Nome de foto inválido.",
        NAO_ENCONTRADA: "Foto não encontrada.",
    },

    GERAL: {
        ERRO_INTERNO: "Ocorreu um erro interno.",
        RECURSO_NAO_ENCONTRADO: "Recurso não encontrado.",
    },
} as const;
