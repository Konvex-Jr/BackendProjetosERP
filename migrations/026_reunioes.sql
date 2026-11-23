-- Sessão 28b: reuniões (agenda unificada). Qualquer pessoa cria; quem criou e a gestão alteram.
-- Data em DATE e hora de São Paulo em TIME, como nas capacitações. Pode rodar de novo sem quebrar.

CREATE TABLE IF NOT EXISTS reunioes (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(200) NOT NULL CHECK (btrim(titulo) <> ''),
    descricao TEXT NOT NULL DEFAULT '',
    data DATE NOT NULL,
    hora TIME NOT NULL,
    duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos BETWEEN 5 AND 720),
    local VARCHAR(300) NOT NULL DEFAULT '',
    criado_por UUID NOT NULL REFERENCES usuarios(codigo) ON DELETE RESTRICT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_reunioes_data ON reunioes(data);

CREATE TABLE IF NOT EXISTS reuniao_participantes (
    reuniao_codigo UUID NOT NULL REFERENCES reunioes(codigo) ON DELETE CASCADE,
    usuario_codigo UUID NOT NULL REFERENCES usuarios(codigo) ON DELETE RESTRICT,
    PRIMARY KEY (reuniao_codigo, usuario_codigo));
CREATE INDEX IF NOT EXISTS idx_reuniao_participantes_usuario ON reuniao_participantes(usuario_codigo);
