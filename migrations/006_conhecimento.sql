-- Sessão 12a: Base de Inteligência (RF-080 a RF-084).
-- Itens de conhecimento consultáveis por todos; cada item pode estar ligado a vários projetos (QA-21).
-- As categorias válidas ficam só no código (source/domain/Enum/CategoriaConhecimento.ts).

CREATE TABLE IF NOT EXISTS conhecimentos (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(160) NOT NULL,
    categoria TEXT NOT NULL,
    resumo VARCHAR(500) NOT NULL,
    conteudo TEXT NOT NULL DEFAULT '',
    autor_codigo UUID REFERENCES usuarios(codigo) ON DELETE SET NULL,
    fonte VARCHAR(300),
    links TEXT[] NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conhecimento_projetos (
    conhecimento_codigo UUID NOT NULL REFERENCES conhecimentos(codigo) ON DELETE CASCADE,
    projeto_codigo UUID NOT NULL REFERENCES projetos(codigo) ON DELETE CASCADE,
    PRIMARY KEY (conhecimento_codigo, projeto_codigo)
);

CREATE INDEX IF NOT EXISTS idx_conhecimentos_data ON conhecimentos(data DESC);
CREATE INDEX IF NOT EXISTS idx_conhecimentos_tags ON conhecimentos USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_conhecimento_projetos_projeto ON conhecimento_projetos(projeto_codigo);
