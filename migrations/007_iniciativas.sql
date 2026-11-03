-- Sessão 12b: Iniciativas de inovação (RF-090 a RF-092, QA-27).
-- Tipos, frentes e status válidos ficam só no código (source/domain/Enum/Iniciativa.ts).
-- Cada iniciativa liga-se a vários projetos e itens da Base; uma tarefa de Inovação aponta para no máximo uma iniciativa.

CREATE TABLE IF NOT EXISTS iniciativas (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(160) NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    tipo TEXT NOT NULL,
    frente TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ideia',
    responsavel_codigo UUID REFERENCES usuarios(codigo) ON DELETE SET NULL,
    criado_por_codigo UUID REFERENCES usuarios(codigo) ON DELETE SET NULL,
    data_inicio DATE,
    data_fim DATE,
    resultado TEXT NOT NULL DEFAULT '',
    aprendizados TEXT NOT NULL DEFAULT '',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iniciativa_projetos (
    iniciativa_codigo UUID NOT NULL REFERENCES iniciativas(codigo) ON DELETE CASCADE,
    projeto_codigo UUID NOT NULL REFERENCES projetos(codigo) ON DELETE CASCADE,
    PRIMARY KEY (iniciativa_codigo, projeto_codigo)
);

CREATE TABLE IF NOT EXISTS iniciativa_conhecimentos (
    iniciativa_codigo UUID NOT NULL REFERENCES iniciativas(codigo) ON DELETE CASCADE,
    conhecimento_codigo UUID NOT NULL REFERENCES conhecimentos(codigo) ON DELETE CASCADE,
    PRIMARY KEY (iniciativa_codigo, conhecimento_codigo)
);

ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS iniciativa_codigo UUID REFERENCES iniciativas(codigo) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_iniciativas_status ON iniciativas(status);
CREATE INDEX IF NOT EXISTS idx_iniciativa_projetos_projeto ON iniciativa_projetos(projeto_codigo);
CREATE INDEX IF NOT EXISTS idx_iniciativa_conhecimentos_item ON iniciativa_conhecimentos(conhecimento_codigo);
CREATE INDEX IF NOT EXISTS idx_tarefas_iniciativa ON tarefas(iniciativa_codigo);
