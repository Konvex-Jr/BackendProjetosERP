-- Biblioteca (sessão 17), parte 1: cria a tabela. As remoções das tabelas antigas entram depois.
CREATE TABLE IF NOT EXISTS biblioteca_itens (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(160) NOT NULL,
    conteudo TEXT NOT NULL DEFAULT '',
    links TEXT[] NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    projeto_codigo UUID REFERENCES projetos(codigo) ON DELETE SET NULL,
    sigilo TEXT NOT NULL DEFAULT 'todos',
    autor_codigo UUID REFERENCES usuarios(codigo) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT biblioteca_itens_sigilo CHECK (sigilo IN ('todos', 'gestao', 'projeto')),
    CONSTRAINT biblioteca_itens_sigilo_projeto CHECK (sigilo <> 'projeto' OR projeto_codigo IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_biblioteca_itens_atualizado ON biblioteca_itens(atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_biblioteca_itens_projeto ON biblioteca_itens(projeto_codigo);
CREATE INDEX IF NOT EXISTS idx_biblioteca_itens_tags ON biblioteca_itens USING GIN (tags);
