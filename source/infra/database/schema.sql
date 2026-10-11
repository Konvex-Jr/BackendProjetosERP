CREATE TYPE perfil_usuario AS ENUM ('diretor', 'gerente', 'membro');
CREATE TYPE status_projeto AS ENUM ('em_execucao', 'concluido');
CREATE TYPE status_tarefa AS ENUM ('pendente', 'andamento', 'concluida');
CREATE TYPE prioridade_tarefa AS ENUM ('P1', 'P2', 'P3', 'P4');
CREATE TYPE tipo_capacitacao AS ENUM ('mecanica', 'computacao', 'eletrica');

CREATE TABLE senioridades (
    codigo varchar(20) PRIMARY KEY,
    nome varchar(30) NOT NULL,
    valor_hora numeric(10,2) NOT NULL DEFAULT 0
);

INSERT INTO senioridades (codigo, nome, valor_hora) VALUES
    ('junior', 'Júnior', 45),
    ('pleno', 'Pleno', 75),
    ('senior', 'Sênior', 120);

CREATE TABLE usuarios (
    codigo uuid PRIMARY KEY,
    nome varchar(120) NOT NULL,
    email varchar(160) NOT NULL,
    perfil perfil_usuario NOT NULL DEFAULT 'membro',
    senioridade_codigo varchar(20) REFERENCES senioridades (codigo) ON DELETE SET NULL,
    ativo boolean NOT NULL DEFAULT true,
    senha_hash varchar(255) NOT NULL
);

CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (lower(email));

CREATE TABLE projetos (
    codigo uuid PRIMARY KEY,
    nome varchar(150) NOT NULL,
    descricao text NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    status status_projeto NOT NULL DEFAULT 'em_execucao'
);

CREATE TABLE projeto_membros (
    projeto_codigo uuid NOT NULL REFERENCES projetos (codigo) ON DELETE CASCADE,
    usuario_codigo uuid NOT NULL REFERENCES usuarios (codigo) ON DELETE CASCADE,
    PRIMARY KEY (projeto_codigo, usuario_codigo)
);

CREATE INDEX projeto_membros_usuario_idx ON projeto_membros (usuario_codigo);

CREATE TABLE tarefas (
    codigo uuid PRIMARY KEY,
    projeto_codigo uuid NOT NULL REFERENCES projetos (codigo) ON DELETE CASCADE,
    titulo varchar(200) NOT NULL,
    descricao text,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    status status_tarefa NOT NULL DEFAULT 'pendente',
    prioridade prioridade_tarefa NOT NULL DEFAULT 'P3',
    data_conclusao date,
    depende_de_codigo uuid REFERENCES tarefas (codigo) ON DELETE SET NULL
);

CREATE INDEX tarefas_projeto_idx ON tarefas (projeto_codigo);
CREATE INDEX tarefas_status_data_fim_idx ON tarefas (status, data_fim);

CREATE TABLE tarefa_responsaveis (
    tarefa_codigo uuid NOT NULL REFERENCES tarefas (codigo) ON DELETE CASCADE,
    usuario_codigo uuid NOT NULL REFERENCES usuarios (codigo) ON DELETE CASCADE,
    PRIMARY KEY (tarefa_codigo, usuario_codigo)
);

CREATE INDEX tarefa_responsaveis_usuario_idx ON tarefa_responsaveis (usuario_codigo);

CREATE TABLE tarefa_checklist_itens (
    codigo uuid PRIMARY KEY,
    tarefa_codigo uuid NOT NULL REFERENCES tarefas (codigo) ON DELETE CASCADE,
    texto varchar(300) NOT NULL,
    feito boolean NOT NULL DEFAULT false,
    ordem integer NOT NULL
);

CREATE INDEX tarefa_checklist_tarefa_idx ON tarefa_checklist_itens (tarefa_codigo, ordem);

CREATE TABLE capacitacoes (
    codigo uuid PRIMARY KEY,
    titulo varchar(200) NOT NULL,
    data date NOT NULL,
    hora time NOT NULL,
    instrutor_codigo uuid NOT NULL REFERENCES usuarios (codigo) ON DELETE RESTRICT,
    vagas integer NOT NULL CHECK (vagas > 0),
    tipo tipo_capacitacao NOT NULL,
    sala varchar(60) NOT NULL
);

CREATE TABLE capacitacao_inscricoes (
    capacitacao_codigo uuid NOT NULL REFERENCES capacitacoes (codigo) ON DELETE CASCADE,
    usuario_codigo uuid NOT NULL REFERENCES usuarios (codigo) ON DELETE CASCADE,
    inscrito_em timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (capacitacao_codigo, usuario_codigo)
);

CREATE INDEX capacitacao_inscricoes_usuario_idx ON capacitacao_inscricoes (usuario_codigo);

CREATE TABLE capacitacao_feedbacks (
    codigo uuid PRIMARY KEY,
    capacitacao_codigo uuid NOT NULL REFERENCES capacitacoes (codigo) ON DELETE CASCADE,
    usuario_codigo uuid NOT NULL REFERENCES usuarios (codigo) ON DELETE CASCADE,
    nota smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
    bom text,
    melhorar text,
    data date NOT NULL,
    UNIQUE (capacitacao_codigo, usuario_codigo)
);

CREATE TABLE checkins (
    codigo uuid PRIMARY KEY,
    usuario_codigo uuid NOT NULL REFERENCES usuarios (codigo) ON DELETE CASCADE,
    semana date NOT NULL,
    humor smallint NOT NULL DEFAULT 3 CHECK (humor BETWEEN 1 AND 5),
    resumo text NOT NULL,
    aprendizados text NOT NULL,
    sentimento text,
    UNIQUE (usuario_codigo, semana)
);

CREATE INDEX checkins_semana_idx ON checkins (semana);

CREATE TABLE pastas (
    codigo uuid PRIMARY KEY,
    nome varchar(120) NOT NULL
);

CREATE TABLE documentos (
    codigo uuid PRIMARY KEY,
    pasta_codigo uuid NOT NULL REFERENCES pastas (codigo) ON DELETE CASCADE,
    nome varchar(255) NOT NULL,
    extensao varchar(5),
    tamanho_bytes bigint NOT NULL,
    data_envio date NOT NULL,
    autor_codigo uuid NOT NULL REFERENCES usuarios (codigo) ON DELETE RESTRICT,
    arquivo_url text NOT NULL
);

CREATE INDEX documentos_pasta_idx ON documentos (pasta_codigo);
