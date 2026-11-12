const codigo = {
    name: "codigo",
    in: "path",
    required: true,
    schema: { type: "string" },
};

const codigoPasta = {
    name: "codigoPasta",
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

const CORPO_CONHECIMENTO = {
    type: "object",
    required: ["titulo", "categoria", "resumo"],
    properties: {
        titulo: { type: "string", maxLength: 160 },
        categoria: { type: "string", description: "Valor de GET /conhecimento/categorias." },
        resumo: { type: "string", maxLength: 500 },
        conteudo: { type: "string", description: "Markdown simples." },
        fonte: { type: "string" },
        links: { type: "array", items: { type: "string", format: "uri" }, maxItems: 10 },
        tags: { type: "array", items: { type: "string" }, maxItems: 10 },
        data: { type: "string", format: "date", description: "Data do item; padrão hoje." },
        codigosProjetos: { type: "array", items: { type: "string" } },
    },
};

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

const CORPO_INICIATIVA = {
    type: "object",
    required: ["titulo", "tipo", "frente"],
    properties: {
        titulo: { type: "string", maxLength: 160 },
        tipo: { type: "string", description: "Valor de GET /iniciativas/opcoes (tipos)." },
        frente: { type: "string", description: "Valor de GET /iniciativas/opcoes (frentes)." },
        status: { type: "string", description: "Valor de GET /iniciativas/opcoes (status); padrão ideia." },
        descricao: { type: "string", description: "Markdown simples." },
        codigoResponsavel: { type: "string", description: "Pessoa ativa. Ao criar, padrão = quem cria; ao editar, ausente mantém." },
        dataInicio: { type: "string", format: "date" },
        dataFim: { type: "string", format: "date" },
        resultado: { type: "string", description: "Markdown simples." },
        aprendizados: { type: "string", description: "Markdown simples." },
        codigosProjetos: { type: "array", items: { type: "string" }, description: "PUT substitui a lista." },
        codigosConhecimentos: { type: "array", items: { type: "string" }, description: "Itens da Base. PUT substitui a lista." },
    },
};

const swaggerSpecification = {
    openapi: "3.0.3",
    info: {
        title: "Konvex Gestão de Projetos API",
        version: "1.0.0",
        description: "API de usuários, projetos, tarefas, capacitações, documentos, Base de Inteligência e iniciativas.",
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
                },
            },
            TarefaInput: {
                type: "object",
                description: "Informe codigoProjeto (tarefa de projeto) OU categoria (tarefa avulsa, só a gestão cria).",
                required: ["titulo", "dataInicio", "dataFim"],
                properties: {
                    codigoProjeto: { type: "string", nullable: true },
                    categoria: { type: "string", nullable: true, enum: ["inovacao", "capacitacao", "execucao"] },
                    codigoIniciativa: {
                        type: "string",
                        nullable: true,
                        description: "Só em tarefa de Inovação (400 INICIATIVA_SO_EM_INOVACAO). No PUT, ausente mantém; vazio desliga.",
                    },
                    titulo: { type: "string" },
                    dataInicio: { type: "string", format: "date-time" },
                    dataFim: { type: "string", format: "date-time" },
                    prioridade: { type: "string", enum: ["P1", "P2", "P3", "P4"] },
                    descricao: { type: "string", nullable: true },
                    codigosResponsaveis: { type: "array", items: { type: "string" } },
                    codigoDependencia: { type: "string", nullable: true },
                    checklist: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["texto", "feito"],
                            properties: {
                                codigo: { type: "string", format: "uuid" },
                                texto: { type: "string", maxLength: 300 },
                                feito: { type: "boolean" },
                            },
                        },
                    },
                },
            },
        },
        parameters: { codigo, codigoPasta },
    },
    security: [{ AccessToken: [] }],
    paths: {
        "/": {
            get: operation(["Sistema"], "Verificar se a API está ativa", {
                security: [],
            }),
        },
        "/auth/login": {
            post: operation(["Autenticação"], "Autenticar usuário", {
                security: [],
                requestBody: jsonBody({
                    type: "object",
                    required: ["email", "senha"],
                    properties: {
                        email: { type: "string", format: "email" },
                        senha: { type: "string" },
                    },
                }),
            }),
        },
        "/usuarios": {
            get: operation(["Usuários"], "Listar usuários"),
            post: operation(["Usuários"], "Cadastrar usuário (somente diretor/gerente)", {
                requestBody: jsonBody({
                    type: "object",
                    required: ["nome", "email", "senha", "perfil"],
                    properties: {
                        nome: { type: "string" },
                        email: { type: "string", format: "email" },
                        senha: { type: "string", minLength: 6 },
                        perfil: { type: "string", enum: ["diretor", "gerente", "membro"] },
                        senioridade: { type: "object", nullable: true },
                    },
                }),
            }),
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
                    },
                }),
            }),
            delete: operation(["Usuários"], "Inativar usuário", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
        "/projetos": {
            get: operation(["Projetos"], "Listar projetos", {
                parameters: [{ name: "codigoUsuario", in: "query", schema: { type: "string" } }],
            }),
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
            get: operation(["Tarefas"], "Listar tarefas (membro: dos seus projetos e as avulsas em que é responsável)", {
                parameters: [
                    { name: "codigoProjeto", in: "query", schema: { type: "string" } },
                    { name: "codigoResponsavel", in: "query", schema: { type: "string" } },
                    { name: "minhas", in: "query", schema: { type: "boolean" }, description: "Só as tarefas em que eu sou responsável." },
                    {
                        name: "categoria",
                        in: "query",
                        schema: { type: "string", enum: ["inovacao", "capacitacao", "execucao", "avulsas"] },
                    },
                    { name: "status", in: "query", schema: { type: "string", enum: ["pendente", "andamento", "concluida"] } },
                ],
            }),
            post: operation(["Tarefas"], "Criar tarefa", {
                requestBody: jsonBody({ $ref: "#/components/schemas/TarefaInput" }),
            }),
        },
        "/tarefas/{codigo}": {
            put: operation(["Tarefas"], "Editar tarefa", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody({ $ref: "#/components/schemas/TarefaInput" }),
            }),
            delete: operation(["Tarefas"], "Excluir tarefa", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
        "/tarefas/{codigo}/status": {
            patch: operation(["Tarefas"], "Alterar status da tarefa", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody({
                    type: "object",
                    required: ["status"],
                    properties: { status: { type: "string", enum: ["pendente", "andamento", "concluida"] } },
                }),
            }),
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
            put: operation(["Capacitações"], "Marcar presença depois do início (gestão); os inscritos fora da lista ficam ausentes", {
                parameters: [codigo],
                requestBody: jsonBody({
                    type: "object",
                    required: ["presentes"],
                    properties: { presentes: { type: "array", items: { type: "string" } } },
                }),
            }),
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
        "/conhecimento/categorias": {
            get: operation(["Base de Inteligência"], "Categorias válidas (RF-081) com rótulos"),
        },
        "/conhecimento": {
            get: operation(["Base de Inteligência"], "Listar itens com busca e filtros (todos leem)", {
                parameters: [
                    { name: "busca", in: "query", schema: { type: "string" }, description: "Procura no título, resumo, conteúdo e tags." },
                    { name: "categoria", in: "query", schema: { type: "string" } },
                    { name: "tag", in: "query", schema: { type: "string" } },
                    { name: "codigoAutor", in: "query", schema: { type: "string" } },
                    { name: "codigoProjeto", in: "query", schema: { type: "string" } },
                    { name: "de", in: "query", schema: { type: "string", format: "date" } },
                    { name: "ate", in: "query", schema: { type: "string", format: "date" } },
                ],
            }),
            post: operation(["Base de Inteligência"], "Cadastrar item (qualquer pessoa logada; vira o autor)", {
                requestBody: jsonBody(CORPO_CONHECIMENTO),
            }),
        },
        "/conhecimento/{codigo}": {
            get: operation(["Base de Inteligência"], "Abrir item (404 se não existe)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
            put: operation(["Base de Inteligência"], "Editar item (autor ou gestão)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody(CORPO_CONHECIMENTO),
            }),
            delete: operation(["Base de Inteligência"], "Excluir item (autor ou gestão)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
        "/iniciativas/opcoes": {
            get: operation(["Iniciativas"], "Status, tipos e frentes com rótulos, e se a pessoa pode criar"),
        },
        "/iniciativas": {
            get: operation(["Iniciativas"], "Listar iniciativas com busca e filtros (todos leem)", {
                parameters: ["busca", "status", "tipo", "frente", "codigoResponsavel", "codigoProjeto", "codigoConhecimento"].map(
                    (name) => ({ name, in: "query", schema: { type: "string" } }),
                ),
            }),
            post: operation(["Iniciativas"], "Criar iniciativa (gestão ou área de Inovação; 403 para os demais)", {
                requestBody: jsonBody(CORPO_INICIATIVA),
            }),
        },
        "/iniciativas/{codigo}": {
            get: operation(["Iniciativas"], "Ficha com projetos, itens da Base e tarefas ligadas (as que a pessoa pode ver) e contagem", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
            put: operation(["Iniciativas"], "Editar (responsável, quem criou ou gestão)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody(CORPO_INICIATIVA),
            }),
            delete: operation(["Iniciativas"], "Excluir (responsável, quem criou ou gestão); tarefas ficam sem a ligação", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
        "/anexos/regras": {
            get: operation(["Anexos"], "Tamanho máximo (bytes) e extensões aceitas"),
        },
        "/anexos/{codigo}": {
            get: operation(["Anexos"], "Baixar o arquivo (mesmas regras de leitura do dono; 404 se não pode ler)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
            delete: operation(["Anexos"], "Excluir anexo (quem pode alterar o dono); o de documento leva o documento junto", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
        "/conhecimento/{codigo}/anexos": {
            post: operation(["Anexos"], "Anexar arquivo a um item da Base (autor ou gestão)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }, nomeArquivo],
                requestBody: corpoArquivo,
            }),
        },
        "/iniciativas/{codigo}/anexos": {
            post: operation(["Anexos"], "Anexar arquivo a uma iniciativa (responsável, quem criou ou gestão)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }, nomeArquivo],
                requestBody: corpoArquivo,
            }),
        },
        "/pastas/{codigoPasta}/documentos/arquivo": {
            post: operation(["Anexos"], "Criar documento do tipo arquivo numa pasta (gestão)", {
                parameters: [
                    { $ref: "#/components/parameters/codigoPasta" },
                    nomeArquivo,
                    {
                        name: "nome",
                        in: "query",
                        required: false,
                        description: "Nome do documento (padrão: nome do arquivo sem extensão).",
                        schema: { type: "string" },
                    },
                ],
                requestBody: corpoArquivo,
            }),
        },
        "/pastas": {
            get: operation(["Documentos"], "Listar as pastas que a pessoa pode ler (sigilo)"),
            post: operation(["Documentos"], "Criar pasta (gestão)", {
                requestBody: jsonBody({
                    type: "object",
                    required: ["nome"],
                    properties: {
                        nome: { type: "string" },
                        sigilo: {
                            type: "string",
                            enum: ["todos", "gestao", "projeto"],
                            description:
                                "todos: qualquer pessoa ativa; gestao: gerente e diretor; projeto: equipe atual ou passada do projeto + gestão.",
                        },
                        codigoProjeto: { type: "string", description: "Obrigatório quando sigilo = projeto." },
                    },
                }),
            }),
        },
        "/pastas/{codigo}": {
            put: operation(["Documentos"], "Renomear pasta e trocar o sigilo (gestão)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody({
                    type: "object",
                    required: ["nome"],
                    properties: {
                        nome: { type: "string" },
                        sigilo: {
                            type: "string",
                            enum: ["todos", "gestao", "projeto"],
                            description:
                                "todos: qualquer pessoa ativa; gestao: gerente e diretor; projeto: equipe atual ou passada do projeto + gestão.",
                        },
                        codigoProjeto: { type: "string", description: "Obrigatório quando sigilo = projeto." },
                    },
                }),
            }),
            delete: operation(["Documentos"], "Excluir pasta", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
            }),
        },
        "/pastas/{codigoPasta}/documentos": {
            get: operation(["Documentos"], "Listar documentos de uma pasta (404 se a pessoa não pode ler a pasta)", {
                parameters: [{ $ref: "#/components/parameters/codigoPasta" }],
            }),
            post: operation(["Documentos"], "Cadastrar documento como link (gestão)", {
                parameters: [{ $ref: "#/components/parameters/codigoPasta" }],
                requestBody: jsonBody({
                    type: "object",
                    required: ["nome", "arquivoUrl"],
                    properties: {
                        nome: { type: "string" },
                        tamanhoBytes: { type: "integer", description: "Opcional (0 para links)." },
                        arquivoUrl: { type: "string", format: "uri" },
                        extensao: { type: "string" },
                        codigoAutor: { type: "string" },
                    },
                }),
            }),
        },
        "/documentos/{codigo}": {
            put: operation(["Documentos"], "Renomear documento e trocar o link (gestão)", {
                parameters: [{ $ref: "#/components/parameters/codigo" }],
                requestBody: jsonBody({
                    type: "object",
                    required: ["nome"],
                    properties: { nome: { type: "string" }, arquivoUrl: { type: "string", format: "uri" } },
                }),
            }),
            delete: operation(["Documentos"], "Excluir documento", {
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
const rotasFase1: Record<string, Record<string, object>> = {
    "/auth/refresh": { post: operation(["Autenticação"], "Renovar a sessão com o refresh token", { security: [], ...json }) },
    "/auth/logout": { post: operation(["Autenticação"], "Encerrar a sessão (revoga o refresh token)", { security: [], ...json }) },
    "/auth/me": { get: operation(["Autenticação"], "Dados da pessoa logada") },
    "/auth/permissoes": { get: operation(["Autenticação"], "Ações liberadas e menu da pessoa logada") },
    "/auth/senha": { put: operation(["Autenticação"], "Trocar a própria senha", json) },
    "/auth/perfil": {
        put: operation(
            ["Autenticação"],
            "Editar os próprios dados (telefone, LinkedIn, calendarioUrl, githubUrl, tecnologias[], curso, semestre, bio)",
            json,
        ),
    },
    "/usuarios/{codigo}": {
        get: operation(["Usuários"], "Consultar pessoa", comCodigo()),
    },
    "/usuarios/{codigo}/perfil": { get: operation(["Usuários"], "Perfil: projetos, histórico e capacitações (RF-013)", comCodigo()) },
    "/usuarios/{codigo}/status": {
        patch: operation(["Usuários"], "Mudar status: ativo, trainee, alumni, inativo (RF-011)", comCodigo(json)),
    },
    "/usuarios/{codigo}/senha": { put: operation(["Usuários"], "Redefinir a senha de uma pessoa (gestores)", comCodigo(json)) },
    "/areas": {
        get: operation(["Configurações"], "Listar áreas"),
        post: operation(["Configurações"], "Criar área (diretores)", json),
    },
    "/areas/{codigo}": { put: operation(["Configurações"], "Editar área (diretores)", comCodigo(json)) },
    "/cargos": {
        get: operation(["Configurações"], "Listar cargos"),
        post: operation(["Configurações"], "Criar cargo (diretores)", json),
    },
    "/cargos/{codigo}": { put: operation(["Configurações"], "Editar cargo (diretores)", comCodigo(json)) },
    "/senioridades/{codigo}": { put: operation(["Configurações"], "Editar nome e ordem da senioridade (diretores)", comCodigo(json)) },
    "/habilidades": { get: operation(["Configurações"], "Listar habilidades e tecnologias cadastradas (?tipo=tecnologia filtra)") },
    "/projetos/{codigo}/membros": { post: operation(["Projetos"], "Adicionar pessoa à equipe (RF-022)", comCodigo(json)) },
    "/projetos/{codigo}/membros/{codigoParticipacao}": {
        put: operation(["Projetos"], "Editar função e alocação", { ...participacao, ...json }),
    },
    "/projetos/{codigo}/membros/{codigoParticipacao}/encerrar": {
        post: operation(["Projetos"], "Encerrar participação", { ...participacao, ...json }),
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
    get: operation(["Projetos"], "Consultar projeto", {
        ...comCodigo(),
        responses: {
            ...operation([], "").responses,
            "403": { description: "Membro fora da equipe atual ou passada do projeto." },
            "404": { description: "Projeto não encontrado." },
        },
    }),
};
