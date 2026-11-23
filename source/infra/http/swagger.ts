const codigo = {
    name: "codigo",
    in: "path",
    required: true,
    schema: { type: "string" },
};

const jsonBody = (schema: object) => ({
    required: true,
    content: { "application/json": { schema } },
});

/** Upload de anexo (sessão 12c): bytes no corpo, nome em X-Nome-Arquivo (encodeURIComponent). */
const corpoArquivo = {
    required: true,
    content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } },
};
const nomeArquivo = {
    name: "X-Nome-Arquivo",
    in: "header",
    required: true,
    description: "Nome do arquivo com extensão, codificado com encodeURIComponent. Até 20 MB; tipos em GET /anexos/regras.",
    schema: { type: "string" },
};

/** Qualquer dia da semana desejada (segunda a domingo); ausente = semana de hoje em São Paulo. */
const SEMANA_OCUPACAO = {
    name: "semana",
    in: "query",
    schema: { type: "string", format: "date" },
    description: "AAAA-MM-DD de qualquer dia da semana; padrão: hoje (São Paulo).",
};

const operation = (tags: string[], summary: string, options: Record<string, any> = {}) => ({
    tags,
    summary,
    responses: {
        "200": { description: "Operação realizada com sucesso." },
        "401": { description: "Token inválido ou expirado." },
        "403": { description: "Sem permissão para esta ação." },
        "422": { description: "Erro de validação ou regra de negócio." },
    },
    ...options,
});

const CORPO_BIBLIOTECA_PUT = {
    type: "object",
    description: "Campo ausente mantém o valor atual; codigoProjeto null tira o projeto.",
    properties: {
        titulo: { type: "string", maxLength: 160 },
        conteudo: { type: "string", description: "Markdown simples, até 50 mil caracteres." },
        links: {
            oneOf: [{ type: "array", items: { type: "string", format: "uri" }, maxItems: 10 }, { type: "string" }],
            description: "Array ou texto separado por vírgulas; só http(s).",
        },
        tags: {
            oneOf: [{ type: "array", items: { type: "string" }, maxItems: 10 }, { type: "string" }],
            description: "Array ou texto separado por vírgulas; normalizadas (minúsculas, sem #, sem repetição).",
        },
        codigoProjeto: { type: "string", nullable: true, description: "Membro: só projeto de que participa ou participou." },
        sigilo: {
            type: "string",
            enum: ["todos", "gestao", "projeto"],
            default: "todos",
            description: "gestao só com biblioteca.gerir; projeto exige projeto.",
        },
    },
};

const CORPO_BIBLIOTECA = { ...CORPO_BIBLIOTECA_PUT, required: ["titulo"], description: "Só o título é obrigatório." };

const CORPO_CAPACITACAO = {
    type: "object",
    required: ["titulo", "data", "hora", "codigoInstrutor", "vagas", "tipo", "sala"],
    properties: {
        titulo: { type: "string", maxLength: 200 },
        descricao: { type: "string", description: "Markdown simples, até 10 mil caracteres." },
        data: { type: "string", format: "date" },
        hora: { type: "string", example: "18:30", description: "Hora de São Paulo." },
        duracaoHoras: { type: "number", minimum: 0.5, maximum: 24, example: 1.5 },
        codigoInstrutor: { type: "string" },
        vagas: { type: "integer", minimum: 1, maximum: 500 },
        tipo: { type: "string", enum: ["computacao", "eletrica", "mecanica"] },
        sala: { type: "string", maxLength: 60 },
    },
};

const swaggerSpecification = {
    openapi: "3.0.3",
    info: {
        title: "Konvex Gestão de Projetos API",
        version: "1.0.0",
        description: "API de usuários, projetos, tarefas, capacitações e Biblioteca.",
    },
    servers: [{ url: process.env.SWAGGER_SERVER_URL ?? `http://localhost:${process.env.PORT ?? 5001}`, description: "Servidor da API" }],
    components: {
        securitySchemes: {
            AccessToken: {
                type: "apiKey",
                in: "header",
                name: "access-token",
                description: "Token JWT retornado pelo endpoint /auth/login. Informe o token sem o prefixo Bearer.",
            },
        },
        schemas: {
            Erro: { type: "object", properties: { message: { type: "string" } } },
            ProjetoInput: {
                type: "object",
                required: ["nome", "descricao", "dataInicio", "dataFim"],
                properties: {
                    nome: { type: "string" },
                    descricao: { type: "string" },
                    dataInicio: { type: "string", format: "date-time" },
                    dataFim: { type: "string", format: "date-time" },
                    codigosMembros: { type: "array", items: { type: "string" } },
                    sigiloso: {
                        type: "boolean",
                        description:
                            "Projeto sigiloso. Na edição, omitido mantém o atual; quem edita o projeto pode marcar e desmarcar. Ligar o sigilo (criar sigiloso ou marcar um que não era) sem ser diretor e sem estar na equipe que fica: 400 SIGILOSO_SEM_VOCE.",
                    },
                },
            },
            TarefaInput: {
                type: "object",
                description: "Toda tarefa tem projeto (sessão 23b): sem codigoProjeto, 400 PROJETO_OBRIGATORIO. `categoria` é ignorada.",
                required: ["codigoProjeto", "titulo", "dataInicio", "dataFim"],
                properties: {
                    codigoProjeto: { type: "string" },
                    titulo: { type: "string" },
                    dataInicio: { type: "string", format: "date-time" },
                    dataFim: { type: "string", format: "date-time" },
                    prioridade: { type: "string", enum: ["P1", "P2", "P3", "P4"] },
                    descricao: { type: "string", nullable: true },
                    codigosResponsaveis: { type: "array", items: { type: "string" } },
                    codigoDependencia: { type: "string", nullable: true },
                    codigoColuna: {
                        type: "string",
                        nullable: true,
                        description:
                            "Coluna do quadro do projeto. Ao criar, o padrão é a de entrada; ao editar, vale mais que `status`. A resposta traz `coluna` ({ codigo, nome, cor, papel }).",
                    },
                    checklist: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["texto", "feito"],
                            properties: {
                                codigo: { type: "string", format: "uuid" },
                                texto: { type: "string", maxLength: 300 },
                                feito: {
                                    type: "boolean",
                                    description: "Só vale ao criar; ao editar, o feito de item que já existe vem do banco.",
                                },
                                codigoResponsavel: {
                                    type: "string",
                                    format: "uuid",
                                    nullable: true,
                                    description: "Um dos responsáveis da tarefa (400 RESPONSAVEL_ITEM_FORA_DA_TAREFA).",
                                },
                            },
                        },
                    },
                },
            },
        },
        parameters: { codigo },
    },
    security: [{ AccessToken: [] }],
    paths: {
        "/": {
            get: operation(["Sistema"], "Verificar se a API está ativa", {
                security: [],
            }),
        },
        "/auth/login": {
            post: operation(["Autenticação"], "Autenticar usuário (5 erros em 15 min pelo mesmo e-mail e IP dão 429)", {
                security: [],
                requestBody: jsonBody({
                    type: "object",
                    required: ["email", "senha"],
                    properties: {
                        email: { type: "string", format: "email" },
                        senha: { type: "string" },
                        manterConectado: { type: "boolean", description: "Grava o cookie HttpOnly konvex_lembrar (15 dias)" },
                    },
                }),
            }),
        },
        "/usuarios": {
            get: operation(["Usuários"], "Listar usuários"),
            post: operation(
                ["Usuários"],
                "Cadastrar usuário sem senha (somente diretor/gerente); envia o convite por e-mail e devolve conviteEnviado",
                {
                    requestBody: jsonBody({
                        type: "object",
                        required: ["nome", "email", "perfil"],
                        properties: {
                            nome: { type: "string" },
                            email: { type: "string", format: "email" },
                            perfil: { type: "string", enum: ["diretor", "gerente", "membro"] },
                            senioridade: { type: "object", nullable: true },
                            status: { type: "string", enum: ["ativo", "trainee"], description: "Status inicial (padrão ativo)" },
                            curso: {
                                type: "string",
                                enum: ["Ciência da Computação", "Engenharia Mecânica", "Engenharia Elétrica"],
                                description: "Obrigatório na criação (400 CURSO_OBRIGATORIO / CURSO_INVALIDO)",
                            },
                            telefone: {
                                type: "string",
                                example: "(11) 99999-9999",
                                description: "10 ou 11 dígitos (400 TELEFONE_INVALIDO)",
                            },
                            emailPessoal: { type: "string", format: "email", maxLength: 254, description: "400 EMAIL_PESSOAL_INVALIDO" },
                        },
                    }),
                },
            ),
        },
        "/senioridades": {
            get: operation(["Usuários"], "Listar senioridades e valores-hora"),
        },
        "/usuarios/{codigo}": {
            put: operation(["Usuários"], "Editar usuário", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody({
                    type: "object",
                    required: ["nome", "email", "perfil"],
                    properties: {
                        nome: { type: "string" },
                        email: { type: "string", format: "email" },
                        perfil: { type: "string", enum: ["diretor", "gerente", "membro"] },
                        senioridade: { type: "object", nullable: true },
                        curso: {
                            type: "string",
                            enum: ["Ciência da Computação", "Engenharia Mecânica", "Engenharia Elétrica"],
                            description: "Conferido só quando muda",
                        },
                        telefone: { type: "string", description: "10 ou 11 dígitos; conferido só quando muda" },
                        emailPessoal: { type: "string", format: "email", maxLength: 254, nullable: true },
                        fimTrainee: {
                            type: "string",
                            format: "date",
                            nullable: true,
                            description: "Só a gestão; não antes da entrada nem no futuro (a troca Trainee para Ativo grava hoje)",
                        },
                    },
                }),
            }),
            delete: operation(["Usuários"], "Inativar usuário (motivo da saída obrigatório; ninguém é excluído)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody({
                    type: "object",
                    required: ["motivoSaida"],
                    properties: {
                        motivoSaida: { type: "string", maxLength: 500, description: "400 MOTIVO_SAIDA_OBRIGATORIO / MOTIVO_SAIDA_LONGO" },
                        dataSaida: { type: "string", format: "date" },
                    },
                }),
            }),
        },
        "/projetos": {
            get: operation(
                ["Projetos"],
                "Listar todos os projetos (sessão 27a): completo (com `tarefas`) para a equipe e a gestão (no sigiloso, equipe atual e diretores); para os demais, cartão { codigo, nome, tipo, area, status, lider, sigiloso, geralDaArea, cartao: true }. Filtros de pessoa e responsável descartam os cartões; busca no cartão só pelo nome",
                {
                    parameters: [{ name: "codigoUsuario", in: "query", schema: { type: "string" } }],
                },
            ),
            post: operation(["Projetos"], "Criar projeto", {
                requestBody: jsonBody({ $ref: "#/components/schemas/ProjetoInput" }),
            }),
        },
        "/projetos/{codigo}": {
            put: operation(["Projetos"], "Editar projeto", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody({ $ref: "#/components/schemas/ProjetoInput" }),
            }),
            delete: operation(["Projetos"], "Excluir projeto", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
        "/projetos/{codigo}/status": {
            patch: operation(["Projetos"], "Alternar status do projeto", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
        "/tarefas": {
            get: operation(
                ["Tarefas"],
                "Listar tarefas (membro: dos projetos de que participa ou participou, do geral da área e as em que é responsável)",
                {
                    parameters: [
                        { name: "codigoProjeto", in: "query", schema: { type: "string" } },
                        { name: "codigoResponsavel", in: "query", schema: { type: "string" } },
                        {
                            name: "minhas",
                            in: "query",
                            schema: { type: "boolean" },
                            description: "Só as tarefas em que eu sou responsável.",
                        },
                        { name: "status", in: "query", schema: { type: "string", enum: ["pendente", "andamento", "concluida"] } },
                    ],
                },
            ),
            post: operation(
                ["Tarefas"],
                "Criar tarefa. Devolve a tarefa com `avisosOcupacao`: [{ codigoUsuario, nome, horas, teto, percentual, semana }] dos responsáveis acima de 100% (não bloqueia).",
                {
                    requestBody: jsonBody({ $ref: "#/components/schemas/TarefaInput" }),
                },
            ),
        },
        "/tarefas/{codigo}": {
            put: operation(
                ["Tarefas"],
                "Editar tarefa. Devolve a tarefa com `avisosOcupacao`: [{ codigoUsuario, nome, horas, teto, percentual, semana }] dos responsáveis acima de 100% (não bloqueia).",
                {
                    parameters: [{ $ref: "#/components/parameters/codigo" }],
                    requestBody: jsonBody({ $ref: "#/components/schemas/TarefaInput" }),
                },
            ),
            delete: operation(["Tarefas"], "Excluir tarefa", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
        "/tarefas/{codigo}/status": {
            patch: operation(
                ["Tarefas"],
                "Alterar status da tarefa. Devolve a tarefa com `avisosOcupacao`: [{ codigoUsuario, nome, horas, teto, percentual, semana }] dos responsáveis acima de 100% (não bloqueia).",
                {
                    parameters: [{ $ref: "#/components/parameters/codigo" }],
                    requestBody: jsonBody({
                        type: "object",
                        required: ["status"],
                        properties: { status: { type: "string", enum: ["pendente", "andamento", "concluida"] } },
                    }),
                },
            ),
        },
        "/tarefas/{codigo}/coluna": {
            patch: operation(
                ["Tarefas"],
                "Mover a tarefa para uma coluna do quadro do projeto (mesma permissão do status; o status vem do papel da coluna; 400 COLUNA_DE_OUTRO_PROJETO). Devolve a tarefa com `avisosOcupacao`",
                {
                    parameters: [{ $ref: "#/components/parameters/codigo" }],
                    requestBody: jsonBody({
                        type: "object",
                        required: ["codigoColuna"],
                        properties: { codigoColuna: { type: "string" } },
                    }),
                },
            ),
        },
        "/tarefas/{codigo}/checklist/{item}": {
            patch: operation(
                ["Tarefas"],
                "Marcar ou desmarcar um item do checklist na hora (quem muda a situação ou edita a tarefa; 404 item que não é da tarefa; 400 FEITO_INVALIDO). Devolve a tarefa com `avisosOcupacao`",
                {
                    parameters: [
                        { $ref: "#/components/parameters/codigo" },
                        { name: "item", in: "path", required: true, schema: { type: "string" } },
                    ],
                    requestBody: jsonBody({
                        type: "object",
                        required: ["feito"],
                        properties: { feito: { type: "boolean" } },
                    }),
                },
            ),
        },
        "/tarefas/{codigo}/conclusao": {
            patch: operation(
                ["Tarefas"],
                "Corrigir a data de conclusão de tarefa concluída (quem muda o status ou edita a tarefa; quem concluiu não muda; 400 TAREFA_NAO_CONCLUIDA, DATA_CONCLUSAO_FUTURA, DATA_CONCLUSAO_ANTES_DO_INICIO)",
                {
                    parameters: [{ $ref: "#/components/parameters/codigo" }],
                    requestBody: jsonBody({
                        type: "object",
                        required: ["dataConclusao"],
                        properties: { dataConclusao: { type: "string", format: "date-time" } },
                    }),
                },
            ),
        },
        "/agenda": {
            get: operation(
                ["Agenda"],
                "Agenda unificada de um período: { pessoa, de, ate, itens }. Itens: reuniao (da pessoa), prazo (tarefas em que a pessoa é responsável; sem título nem código se quem pede não vê o projeto completo), capacitacao (todas, com inscrito e ministra). Só a gestão (projetos.verTodos) usa `pessoa`. 400 AGENDA_PERIODO_INVALIDO (no máximo 62 dias), 403, 404",
                {
                    parameters: [
                        { name: "de", in: "query", required: true, schema: { type: "string", example: "2026-12-01" } },
                        { name: "ate", in: "query", required: true, schema: { type: "string", example: "2026-12-31" } },
                        { name: "pessoa", in: "query", required: false, schema: { type: "string" } },
                    ],
                },
            ),
        },
        "/reunioes": {
            post: operation(
                ["Agenda"],
                "Criar reunião (todo logado): { titulo, descricao?, data AAAA-MM-DD, hora HH:MM, duracaoMinutos (5 a 720), local?, participantes: códigos de pessoas ativas na EJ }. Quem cria entra como participante. 400 PARTICIPANTE_INVALIDO",
                {
                    requestBody: jsonBody({
                        type: "object",
                        properties: {
                            titulo: { type: "string" },
                            descricao: { type: "string" },
                            data: { type: "string" },
                            hora: { type: "string" },
                            duracaoMinutos: { type: "integer" },
                            local: { type: "string" },
                            participantes: { type: "array", items: { type: "string" } },
                        },
                    }),
                },
            ),
        },
        "/reunioes/{codigo}": {
            get: operation(
                ["Agenda"],
                "Ficha da reunião com participantes (e-mail para o convite do Google Agenda) e podeAlterar. 404 para quem não participa (a gestão vê todas)",
                {
                    parameters: [{ name: "codigo", in: "path", required: true, schema: { type: "string" } }],
                },
            ),
            put: operation(
                ["Agenda"],
                "Editar a reunião (quem criou ou a gestão; campo ausente mantém o valor; quem criou não sai). 403 sem permissão",
                {
                    parameters: [{ name: "codigo", in: "path", required: true, schema: { type: "string" } }],
                },
            ),
            delete: operation(["Agenda"], "Excluir a reunião (quem criou ou a gestão). 204", {
                parameters: [{ name: "codigo", in: "path", required: true, schema: { type: "string" } }],
            }),
        },
        "/avisos": {
            get: operation(
                ["Painel"],
                "Central de avisos de quem está logado: { naoLidos, gravados (no máximo 30: tarefa recebida e capacitação nova), situacao (atrasadas, a vencer, capacitação próxima; sobrecarga só para a gestão, quem tem projetos.verTodos: hoje diretor e gerente) }. Tarefas só de projetos com acesso completo",
            ),
        },
        "/avisos/lidos": {
            patch: operation(
                ["Painel"],
                "Marcar avisos como lidos: { codigos?: string[] }, sem codigos marca todos; códigos de outra pessoa são ignorados. Devolve { naoLidos }. 400 AVISOS_CODIGOS_INVALIDOS",
                {
                    requestBody: jsonBody({
                        type: "object",
                        properties: { codigos: { type: "array", items: { type: "string" } } },
                    }),
                },
            ),
        },
        "/ocupacao": {
            get: operation(
                ["Tarefas"],
                "Ocupação semanal de todas as pessoas ativas e trainees: [{ codigoUsuario, nome, horas, teto, percentual }] (todo logado; 400 SEMANA_INVALIDA)",
                { parameters: [SEMANA_OCUPACAO] },
            ),
        },
        "/ocupacao/{codigoUsuario}": {
            get: operation(
                ["Tarefas"],
                "Ocupação semanal de uma pessoa: { codigoUsuario, horas, teto, percentual, semana, itens }. Itens pelo acesso de quem pede ao projeto: tarefa (título e projeto), projeto (só nome e horas somadas: gestão com só o cartão, ou seja, fora de sigiloso) ou outras (tudo somado, sem título nem projeto). 404 pessoa inexistente",
                {
                    parameters: [{ name: "codigoUsuario", in: "path", required: true, schema: { type: "string" } }, SEMANA_OCUPACAO],
                },
            ),
        },
        "/capacitacoes/opcoes": {
            get: operation(["Capacitações"], "Tipos com rótulo e se a pessoa pode gerir (gestão)"),
        },
        "/capacitacoes": {
            get: operation(
                ["Capacitações"],
                "Listar capacitações (todos; inscritos só para gestão e instrutor; média e total de avaliações)",
            ),
            post: operation(["Capacitações"], "Criar capacitação (gestão)", { requestBody: jsonBody(CORPO_CAPACITACAO) }),
        },
        "/capacitacoes/{codigo}": {
            get: operation(["Capacitações"], "Ficha da capacitação, com a avaliação da própria pessoa", { parameters: [codigo] }),
            put: operation(["Capacitações"], "Editar capacitação (gestão; vagas não podem ficar abaixo dos inscritos)", {
                parameters: [codigo],
                requestBody: jsonBody(CORPO_CAPACITACAO),
            }),
            delete: operation(["Capacitações"], "Excluir capacitação, inscrições, avaliações e material (gestão)", {
                parameters: [codigo],
            }),
        },
        "/capacitacoes/{codigo}/inscricoes": {
            post: operation(["Capacitações"], "Inscrever-se até o início (gestão pode inscrever outra pessoa com codigoUsuario)", {
                parameters: [codigo],
                requestBody: jsonBody({ type: "object", properties: { codigoUsuario: { type: "string" } } }),
            }),
        },
        "/capacitacoes/{codigo}/inscricoes/{codigoUsuario}": {
            delete: operation(["Capacitações"], "Cancelar inscrição (a própria até o início; a gestão a qualquer momento)", {
                parameters: [codigo, { name: "codigoUsuario", in: "path", required: true, schema: { type: "string" } }],
            }),
        },
        "/capacitacoes/{codigo}/presencas": {
            put: operation(
                ["Capacitações"],
                "Chamada: marcar presença depois do início (gestão ou quem ministra, sessão 28b); os inscritos fora da lista ficam ausentes",
                {
                    parameters: [codigo],
                    requestBody: jsonBody({
                        type: "object",
                        required: ["presentes"],
                        properties: { presentes: { type: "array", items: { type: "string" } } },
                    }),
                },
            ),
        },
        "/capacitacoes/{codigo}/avaliacao": {
            put: operation(["Capacitações"], "Avaliar (só quem compareceu, depois do início); avaliar de novo substitui", {
                parameters: [codigo],
                requestBody: jsonBody({
                    type: "object",
                    required: ["nota"],
                    properties: {
                        nota: { type: "integer", minimum: 1, maximum: 5 },
                        bom: { type: "string" },
                        melhorar: { type: "string" },
                    },
                }),
            }),
        },
        "/capacitacoes/{codigo}/avaliacoes": {
            get: operation(["Capacitações"], "Avaliações individuais (gestão com nome; instrutor sem nome; demais 403)", {
                parameters: [codigo],
            }),
        },
        "/capacitacoes/{codigo}/anexos": {
            post: operation(["Anexos"], "Anexar material a uma capacitação (gestão)", {
                parameters: [codigo, nomeArquivo],
                requestBody: corpoArquivo,
            }),
        },
        "/biblioteca": {
            get: operation(["Biblioteca"], "Listar os itens que a pessoa pode ver, com busca e filtros", {
                parameters: [
                    { name: "q", in: "query", schema: { type: "string" }, description: "Procura no título, conteúdo e tags." },
                    { name: "tag", in: "query", schema: { type: "string" } },
                    { name: "projeto", in: "query", schema: { type: "string" }, description: "Código do projeto." },
                    { name: "sigilo", in: "query", schema: { type: "string", enum: ["todos", "gestao", "projeto"] } },
                    { name: "autor", in: "query", schema: { type: "string" }, description: "Código do autor." },
                ],
            }),
            post: operation(
                ["Biblioteca"],
                "Cadastrar item (qualquer pessoa logada; vira o autor; 403 para sigilo/projeto não permitidos)",
                {
                    requestBody: jsonBody(CORPO_BIBLIOTECA),
                },
            ),
        },
        "/biblioteca/{codigo}": {
            get: operation(["Biblioteca"], "Abrir item (404 se não existe ou a pessoa não pode vê-lo)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
            put: operation(["Biblioteca"], "Editar item (autor ou gestão; 404 se invisível); sigilo e projeto conferidos só se mudarem", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody(CORPO_BIBLIOTECA_PUT),
            }),
            delete: operation(["Biblioteca"], "Excluir item e anexos (autor ou gestão; 404 se invisível); responde 204", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                responses: {
                    "204": { description: "Item excluído." },
                    "401": { description: "Token inválido ou expirado." },
                    "403": { description: "Sem permissão para esta ação." },
                    "404": { description: "Item não encontrado." },
                },
            }),
        },
        "/biblioteca/{codigo}/anexos": {
            post: operation(["Anexos"], "Anexar arquivo a um item da Biblioteca (autor ou gestão; 404 se invisível)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }, nomeArquivo],
                requestBody: corpoArquivo,
            }),
        },
        "/tarefas/{codigo}/anexos": {
            get: operation(
                ["Anexos"],
                "Listar anexos da tarefa, do mais antigo ao mais novo, com podeExcluir (quem vê a tarefa; 404 se não vê)",
                { parameters: [{ $ref: "#/components/parameters/codigo" }] },
            ),
            post: operation(["Anexos"], "Anexar arquivo à tarefa (quem comenta: equipe atual do projeto; 404 se não vê)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }, nomeArquivo],
                requestBody: corpoArquivo,
            }),
        },
        "/anexos/regras": {
            get: operation(["Anexos"], "Tamanho máximo (bytes) e extensões aceitas"),
        },
        "/anexos/{codigo}": {
            get: operation(["Anexos"], "Baixar o arquivo (mesmas regras de leitura do dono; 404 se não pode ler)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
            delete: operation(["Anexos"], "Excluir anexo (quem pode alterar o dono; na tarefa, quem enviou, líder ou gestão)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
    },
};

export default swaggerSpecification;

// Rotas da fase 1 (sessão, pessoas, configurações e equipe de projeto).
const json = { requestBody: jsonBody({ type: "object" }) };
const comCodigo = (extra: object = {}) => ({ parameters: [codigo], ...extra });
const participacao = {
    parameters: [codigo, { name: "codigoParticipacao", in: "path", required: true, schema: { type: "string" } }],
};
const periodo = {
    parameters: [codigo, { name: "codigoPeriodo", in: "path", required: true, schema: { type: "string" } }],
};
const rotasFase1: Record<string, Record<string, object>> = {
    "/auth/refresh": { post: operation(["Autenticação"], "Renovar a sessão com o refresh token", { security: [], ...json }) },
    "/auth/logout": {
        post: operation(["Autenticação"], "Encerrar a sessão (revoga o refresh token e o lembrete do cookie; apaga o cookie)", {
            security: [],
            ...json,
        }),
    },
    "/auth/retomar": {
        post: operation(
            ["Autenticação"],
            "Abrir sessão de aba com o cookie konvex_lembrar (Manter conectado); devolve cookie novo com o mesmo prazo, 401 apaga o cookie",
            { security: [] },
        ),
    },
    "/auth/me": { get: operation(["Autenticação"], "Dados da pessoa logada") },
    "/auth/permissoes": { get: operation(["Autenticação"], "Ações liberadas e menu da pessoa logada") },
    "/auth/esqueci-senha": {
        post: operation(
            ["Autenticação"],
            "Pedir link de redefinição (resposta igual exista o e-mail ou não; 10 pedidos por IP em 15 min)",
            {
                security: [],
                ...json,
            },
        ),
    },
    "/auth/link-senha/{token}": {
        get: operation(["Autenticação"], "Consultar o link de senha (tipo e primeiro nome)", {
            security: [],
            parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        }),
        post: operation(["Autenticação"], "Definir a senha pelo link (uso único; devolve a sessão)", {
            security: [],
            parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
            ...json,
        }),
    },
    "/usuarios/{codigo}/link-senha": {
        post: operation(["Usuários"], "Reenviar convite ou mandar link de redefinição (gestão; nunca devolve o link)", {
            parameters: [{ $ref: "#/components/parameters/codigo" }],
        }),
    },
    "/auth/senha": { put: operation(["Autenticação"], "Trocar a própria senha", json) },
    "/auth/foto": {
        put: operation(
            ["Autenticação"],
            "Trocar a própria foto (corpo cru JPEG, PNG ou WebP, até 300 KB; gravada como WebP 256x256; devolve { foto })",
            {
                requestBody: { required: true, content: { "image/*": { schema: { type: "string", format: "binary" } } } },
            },
        ),
        delete: operation(["Autenticação"], "Remover a própria foto"),
    },
    "/fotos/{arquivo}": {
        get: operation(["Usuários"], "Foto de perfil (pública; nome UUID.webp; 404 se não existe)", {
            security: [],
            parameters: [{ name: "arquivo", in: "path", required: true, schema: { type: "string" } }],
        }),
    },
    "/auth/perfil": {
        put: operation(
            ["Autenticação"],
            "Editar os próprios dados (telefone, emailPessoal, LinkedIn, calendarioUrl, githubUrl, curso, ingresso (AAAA/1 ou AAAA/2), bio)",
            json,
        ),
    },
    "/usuarios/{codigo}": {
        get: operation(["Usuários"], "Consultar pessoa", comCodigo()),
    },
    "/usuarios/{codigo}/perfil": {
        get: operation(["Usuários"], "Perfil: projetos, períodos nas áreas, capacitações e podeGerirPeriodos (RF-013)", comCodigo()),
    },
    "/usuarios/{codigo}/periodos": {
        get: operation(["Usuários"], "Períodos da pessoa nas áreas (abertos primeiro; todos os logados)", comCodigo()),
        post: operation(
            ["Usuários"],
            "Lançar período: { codigoArea, codigoCargo?, inicio, fim? } (gestores; 400 PERIODO_SOBREPOSTO)",
            comCodigo(json),
        ),
    },
    "/usuarios/{codigo}/periodos/{codigoPeriodo}": {
        put: operation(["Usuários"], "Corrigir período: área, cargo e datas (gestores)", { ...periodo, ...json }),
        delete: operation(["Usuários"], "Excluir período (gestores)", periodo),
    },
    "/usuarios/{codigo}/status": {
        patch: operation(
            ["Usuários"],
            "Mudar status: ativo, trainee, inativo (RF-011). { status, motivoSaida?, dataSaida?, encerrarParticipacoes? }: motivoSaida obrigatório ao mudar para inativo (até 500; 400 MOTIVO_SAIDA_OBRIGATORIO). Trainee para ativo grava fimTrainee; voltar a ativo apaga motivo e data de saída",
            comCodigo(json),
        ),
    },
    "/areas": {
        get: operation(["Configurações"], "Listar áreas"),
        post: operation(["Configurações"], "Criar área (diretores): { nome, codigoAreaPai?, ativa?, temGeral? }", json),
    },
    "/areas/{codigo}": {
        put: operation(
            ["Configurações"],
            "Editar área (diretores): { nome, codigoAreaPai?, ativa?, temGeral? }; temGeral false exclui o projeto geral (409 GERAL_COM_TAREFAS se tiver tarefas)",
            comCodigo(json),
        ),
    },
    "/cargos": {
        get: operation(["Configurações"], "Listar cargos"),
        post: operation(["Configurações"], "Criar cargo (diretores)", json),
    },
    "/cargos/{codigo}": { put: operation(["Configurações"], "Editar cargo (diretores)", comCodigo(json)) },
    "/config/horas-dificuldade": {
        get: operation(["Configurações"], "Horas de cada nível de dificuldade da tarefa"),
        put: operation(["Configurações"], "Gravar as horas por dificuldade (diretores)", json),
    },
    "/config/precificacao": {
        get: operation(["Configurações"], "Regras da simulação de precificação (quem tem precificacao.simular)"),
        put: operation(
            ["Configurações"],
            "Gravar as regras da precificação (diretores; todos os campos obrigatórios; 400 REGRA_PRECIFICACAO_INVALIDA)",
            json,
        ),
    },
    "/senioridades/{codigo}": { put: operation(["Configurações"], "Editar nome e ordem da senioridade (diretores)", comCodigo(json)) },
    "/projetos/{codigo}/membros": { post: operation(["Projetos"], "Adicionar pessoa à equipe (RF-022)", comCodigo(json)) },
    "/projetos/{codigo}/membros/{codigoParticipacao}": {
        put: operation(["Projetos"], "Editar função e responsabilidades", { ...participacao, ...json }),
    },
    "/projetos/{codigo}/membros/{codigoParticipacao}/encerrar": {
        post: operation(["Projetos"], "Encerrar participação", { ...participacao, ...json }),
    },
    "/projetos/{codigo}/colunas": {
        put: operation(
            ["Projetos"],
            "Gravar as colunas do quadro ({ colunas: [{ codigo?, nome, cor, papel }] na ordem, destinos?: { codigoDaColunaExcluida: codigoDoDestino } }; só o líder e a gestão; 2 a 12 colunas, uma entrada e uma concluida; 400 DESTINO_COLUNA_OBRIGATORIO, 409 QUADRO_MUDOU). Devolve as colunas gravadas. O projeto (GET /projetos e /projetos/{codigo}) traz `colunas`; o cartão não. Quem só tem o cartão: 403 PROJETO_SEM_ACESSO.",
            comCodigo(json),
        ),
    },
    "/projetos/{codigo}/lider": {
        put: operation(["Projetos"], "Definir o líder ({ codigoUsuario } da equipe atual, ou null)", comCodigo(json)),
    },
    "/tarefas/{codigo}/comentarios": {
        get: operation(["Tarefas"], "Listar comentários da tarefa", comCodigo()),
        post: operation(["Tarefas"], "Comentar (equipe atual, líder ou gestão)", comCodigo(json)),
    },
    "/tarefas/{codigo}/comentarios/{codigoComentario}": {
        delete: operation(["Tarefas"], "Apagar comentário (autor, líder ou gestão)", {
            parameters: [
                { $ref: "#/components/parameters/codigo" },
                { name: "codigoComentario", in: "path", required: true, schema: { type: "string" } },
            ],
        }),
    },
};
const caminhos = (swaggerSpecification as any).paths;
for (const [caminho, metodos] of Object.entries(rotasFase1)) {
    caminhos[caminho] = { ...(caminhos[caminho] ?? {}), ...metodos };
}
caminhos["/senioridades"].post = operation(["Configurações"], "Criar senioridade (diretores)", json);
caminhos["/projetos/{codigo}"] = {
    ...(caminhos["/projetos/{codigo}"] ?? {}),
    get: operation(["Projetos"], "Consultar projeto: completo ou cartão (sessão 27a), sempre 200 para quem está logado", {
        ...comCodigo(),
        responses: {
            ...operation([], "").responses,
            "404": { description: "Projeto não encontrado." },
        },
    }),
};
